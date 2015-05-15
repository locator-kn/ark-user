declare
var Promise:any;

export interface IRegister {
    (server:any, options:any, next:any): void;
    attributes?: any;
}

export default
class User {
    db:any;
    joi:any;
    userSchemaPOST:any;
    userSchemaPUT:any;
    boom:any;
    bcrypt:any;
    gm:any;
    regex:any;

    constructor() {
        this.register.attributes = {
            pkg: require('./../../package.json')
        };

        this.joi = require('joi');
        this.boom = require('boom');
        this.bcrypt = require('bcrypt');
        this.gm = require('gm');
        this.regex = require('locators-regex');
        this.initSchemas();
    }

    private initSchemas():void {
        var user = this.joi.object().keys({
            name: this.joi.string().required(),
            surname: this.joi.string(),
            picture: this.joi.optional(),
            mail: this.joi.string().email().required(),
            password: this.joi.string().required(),
            type: this.joi.string().required().valid('user')
        });

        var putMethodElements = this.joi.object().keys({
            _id: this.joi.string().required(),
            _rev: this.joi.string().required()
        });

        this.userSchemaPOST = user;
        this.userSchemaPUT = putMethodElements.concat(user);

    }

    register:IRegister = (server, options, next) => {
        server.bind(this);

        server.dependency('ark-database', (server, next) => {
            this.db = server.plugins['ark-database'];
            next();
        });


        this._register(server, options);
        next();
    };

    private _register(server, options) {
        // route to get all users
        server.route({
            method: 'GET',
            path: '/users',
            config: {
                handler: (request, reply) => {
                    this.db.getUsers((err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'Get all users',
                tags: ['api', 'user']

            }
        });

        // route to get user
        server.route({
            method: 'GET',
            path: '/users/{userid}',
            config: {
                handler: (request, reply) => {
                    this.db.getUserById(request.params.userid, (err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'Get particular user by user id',
                notes: 'sample call: /users/tiruprec',
                tags: ['api', 'user'],
                validate: {
                    params: {
                        userid: this.joi.string()
                            .required()
                            .description('User id from "LDAP"')
                    }
                }

            }
        });

        // get picture of a user
        server.route({
            method: 'GET',
            path: '/users/{userid}/{name}.{ext}',
            config: {
                // TODO: check auth
                auth: false,
                handler: (request, reply) => {
                    // create file name
                    var file = request.params.name + '.' + request.params.ext;

                    // get file stream from database (no error handling, because there is none)
                    reply(this.db.getPicture(request.params.userid, file));
                },
                description: 'Get the preview picture of a ' +
                'user by id',
                notes: 'sample call: /users/1222123132/profile.jpg',
                tags: ['api', 'user'],
                validate: {
                    params: {
                        userid: this.joi.string()
                            .required(),
                        name: this.joi.string()
                            .required(),
                        ext: this.joi.string()
                            .required().regex(this.regex.imageExtension)
                    }
                }

            }
        });

        // Upload a profile picture
        server.route({
            method: ['POST', 'PUT'],
            path: '/users/{userid}/picture', // 'users/my/picture/'
            config: {
                // TODO: check auth
                auth: false,
                payload: {
                    output: 'stream',
                    parse: true,
                    allow: 'multipart/form-data',
                    // TODO: evaluate real value
                    maxBytes: 1000000000000
                },
                handler: (request, reply) => {

                    var ext = request.payload.file.hapi.headers['content-type']
                        .match(this.regex.imageExtension);
                    var filename = 'profile.' + ext;
                    var thumbname = 'profile-thumb.' + ext;

                    // crop it, scale it and return stream
                    var imageStream = this.gm(request.payload.file)
                        .crop(request.payload.width
                        , request.payload.height
                        , request.payload.xCoord
                        , request.payload.yCoord)
                        .resize(200, 200)
                        .stream();

                    // crop it, scale it for thumbnail and return stream
                    var thumbnailStream = this.gm(request.payload.file)
                        .crop(request.payload.width
                        , request.payload.height
                        , request.payload.xCoord
                        , request.payload.yCoord)
                        .resize(120, 120)
                        .stream();


                    // "/i/" will be mapped to /api/vX/ from nginx
                    var url = '/i/users/' + request.params.userid + '/' + filename;
                    var thumbURL = '/i/users/' + request.params.userid + '/' + thumbname;

                    var imageLocation = {
                        picture: url,
                        thumbnail: thumbURL
                    };

                    function replySuccess() {
                        reply({
                            message: 'ok',
                            imageLocation
                        });
                    }

                    // perform all save actions

                    // save image and return promise
                    this.db.savePicture(request.params.userid, filename, imageStream)
                        .then(() => {
                            // save thumbnail and return promise
                            return this.db.savePicture(request.params.userid, thumbname, thumbnailStream);
                        })
                        .then(() => {
                            // update url fields in document
                            return this.db.updateDocument(request.params.userid, {images: imageLocation});
                        })
                        .then(replySuccess)
                        .catch((err) => {
                            return reply(this.boom.badRequest(err));
                        });

                },
                description: 'Upload profile picture of a user',
                notes: 'The picture will be streamed and attached to the document of this user',
                tags: ['api', 'user'],
                validate: {
                    params: {
                        userid: this.joi.string().
                            required()
                    },
                    payload: {
                        // validate file type to be an image
                        file: this.joi.object({
                            hapi: {
                                headers: {
                                    'content-type': this.joi.string()
                                        .regex(this.regex.imageContentType)
                                        .required()
                                }
                            }
                        }).options({allowUnknown: true}).required(),
                        // validate that a correct dimension object is emitted
                        width: this.joi.number().integer().required(),
                        height: this.joi.number().integer().required(),
                        xCoord: this.joi.number().integer().required(),
                        yCoord: this.joi.number().integer().required()

                    }
                }
            }
        });

        // get user information about logged in user
        server.route({
            method: 'GET',
            path: '/users/me',
            config: {
                handler: (request, reply) => {
                    var id = request.auth.credentials._id;

                    this.db.getUserById(id, (err, data) => {
                        if (err) {
                            return reply(this.boom.badRequest(err));
                        }
                        reply(data[0]);
                    })
                },
                description: 'Get all information about current user',
                notes: 'Identification about current logged in user is get from session parameter "loggedInUser"',
                tags: ['api', 'user']
            }
        });

        // route to create new user
        server.route({
            method: 'POST',
            path: '/users',
            config: {
                auth: false,
                handler: (request, reply) => {
                    this.db.getUserLogin(request.payload.mail).then((user) => {
                        return reply(this.boom.badRequest('mail already exists'));
                    }).catch((err) => {
                        if (err) {
                            return reply(this.boom.badRequest('something went wrong'));
                        }
                        this.bcrypt.genSalt(10, (err, salt) => {
                            this.bcrypt.hash(request.payload.password, salt, (err, hash) => {
                                request.payload.password = hash;
                                request.payload.strategy = 'default';
                                this.db.createUser(request.payload, (err, data) => {
                                    if (err) {
                                        return reply(this.boom.wrap(err, 400));
                                    }
                                    var userSessionData = {
                                        mail: request.payload.mail,
                                        _id: data.id
                                    };
                                    request.auth.session.set(userSessionData);
                                    reply(data);
                                });
                            });
                        });
                    });
                },
                description: 'Create new user',
                notes: '_id is the mail address of the user',
                tags: ['api', 'user'],
                validate: {
                    payload: this.userSchemaPOST
                        .required()
                        .description('User JSON object')
                }
            }
        });

        // route to update user information
        server.route({
            method: 'PUT',
            path: '/users/{userid}',
            config: {
                handler: (request, reply) => {
                    this.db.updateUser(request.params.userid, request.payload._rev, request.payload.user, (err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'Update user information',
                notes: 'It is important to add the "_rev" property!',
                tags: ['api', 'user'],
                validate: {
                    params: {
                        userid: this.joi.string()
                            .required()
                            .description('User Id')
                    },
                    payload: this.userSchemaPUT
                        .required()
                        .description('User JSON object WITH _rev')
                }

            }
        });


        // route to update user password
        server.route({
            method: 'PUT',
            path: '/users/{userid}/password',
            config: {
                handler: (request, reply) => {
                    this.db.updateUserPassword(request.params.userid, request.payload.password, (err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'update password of user by id',
                notes: 'Important: add password as payload',
                tags: ['api', 'user'],
                validate: {
                    params: {
                        userid: this.joi.string()
                            .required()
                            .description('User Id')
                    },
                    payload: this.joi.object().keys({
                        password: this.joi.string().required()
                    })
                }

            }
        });

        // delete a particular user
        server.route({
            method: 'DELETE',
            path: '/users/{userid}',
            config: {
                handler: (request, reply) => {
                    this.db.deleteUserById(request.params.userid, (err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'delete a particular trip',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        userid: this.joi.string()
                            .required()
                    }
                }
            }
        });

        return 'register';
    }
}