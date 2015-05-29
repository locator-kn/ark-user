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
    mailer:any;
    uuid:any;
    imageUtil:any;
    hoek:any;

    constructor() {
        this.register.attributes = {
            pkg: require('./../../package.json')
        };

        this.joi = require('joi');
        this.boom = require('boom');
        this.bcrypt = require('bcrypt');
        this.gm = require('gm').subClass({imageMagick: true});
        this.uuid = require('node-uuid');
        this.imageUtil = require('locator-image-utility');
        this.hoek = require('hoek');
        this.initSchemas();
    }

    register:IRegister = (server, options, next) => {
        server.bind(this);

        server.dependency('ark-database', (server, next) => {
            this.db = server.plugins['ark-database'];
            next();
        });

        server.dependency('ark-mailer', (server, next) => {
            this.mailer = server.plugins['ark-mailer'];
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
                handler: this.getUsers,
                description: 'Get all users',
                tags: ['api', 'user']

            }
        });

        // route to get user
        server.route({
            method: 'GET',
            path: '/users/{userid}',
            config: {
                handler: this.getUserById,
                description: 'Get particular user by user id',
                notes: 'sample call: /users/124239845725',
                tags: ['api', 'user'],
                validate: {
                    params: {
                        userid: this.joi.string()
                            .required()
                            .description('User id from database')
                    }
                }

            }
        });

        // get picture of a user
        // TODO: redirect to special route which handles all pictures
        server.route({
            method: 'GET',
            path: '/users/{userid}/{name}.{ext}',
            config: {
                // TODO: check auth
                auth: false,
                handler: this.getPicture,
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
                            .required().regex(this.imageUtil.regex.imageExtension)
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
                    maxBytes: 1048576 * 6 // 6MB
                },
                handler: this.savePicture,
                description: 'Upload profile picture of a user',
                notes: 'The picture will be streamed and attached to the document of this user',
                tags: ['api', 'user'],
                validate: {
                    params: {
                        userid: this.joi.string().required()
                    },
                    payload: this.imageUtil.validation.basicImageSchema
                }
            }
        });

        // get user information about logged in user
        server.route({
            method: 'GET',
            path: '/users/me',
            config: {
                handler: this.getMe,
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
                handler: this.createUser,
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
                handler: this.updateUser,
                description: 'Update user information',
                notes: 'Update one or more properties of the user. If you want to change the password or mail,' +
                'use PUT /users/:userid/[password or mail]',
                tags: ['api', 'user'],
                validate: {
                    params: {
                        userid: this.joi.string()
                            .required()
                            .description('User Id')
                    },
                    payload: this.userSchemaPUT
                        .required()
                        .description('User JSON object')
                }

            }
        });


        // route to update user password
        server.route({
            method: 'PUT',
            path: '/users/{userid}/password',
            config: {
                handler: this.updateUserPassword,
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

        // route to update user mail
        server.route({
            method: 'PUT',
            path: '/users/{userid}/mail',
            config: {
                handler: this.updateUserMail,
                description: 'update mail of user by id',
                notes: 'A new verify mail will be send',
                tags: ['api', 'user'],
                validate: {
                    params: {
                        userid: this.joi.string()
                            .required()
                            .description('User Id')
                    },
                    payload: this.joi.object().keys({
                        // TODO: verify mail pattern?
                        mail: this.joi.string().required()
                    })
                }

            }
        });

        // delete a particular user
        server.route({
            method: 'DELETE',
            path: '/users/{userid}',
            config: {
                handler: this.deleteUser,
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

    /**
     * Handler function to get all user.
     *
     * @param request
     * @param reply
     */
    getUsers = (request, reply) => {
        this.db.getUsers((err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            reply(data);
        });
    };

    /**
     * Handler function to get user by id.
     *
     * @param request
     * @param reply
     */
    getUserById = (request, reply) => {
        this.db.getUserById(request.params.userid, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            reply(data);
        });
    };

    /**
     * Get picture of user.
     *
     * @param request
     * @param reply
     */
    getPicture = (request, reply) => {
        // create file name
        var file = request.params.name + '.' + request.params.ext;

        // get file stream from database (no error handling, because there is none)
        reply(this.db.getPicture(request.params.userid, file));
    };

    /**
     * Function to save picture in database.
     *
     * @param request
     * @param reply
     */
    private savePicture = (request, reply) => {

        var imageProcessor = this.imageUtil.image.processor(request);

        var file = imageProcessor.createFileInformation('profile');

        var attachmentData = imageProcessor.getAttachmentData(file.filename);

        // crop it, scale it and return stream
        var imageStream = imageProcessor.createCroppedStream(200, 200);

        // crop it, scale it for thumbnail and return stream
        var thumbnailStream = imageProcessor.createCroppedStream(120, 120);

        // save image and return promise
        this.db.savePicture(request.params.userid, attachmentData, imageStream)
            .then(() => {
                // save thumbnail and return promise
                attachmentData.name = file.thumbnailName;
                return this.db.savePicture(request.params.userid, attachmentData, thumbnailStream);
            }).then(() => {
                // update url fields in document
                return this.db.updateDocument(request.params.userid, {picture: file.imageLocation});
            }).then((value) => {
                this.replySuccess(reply, file.imageLocation, value)
            }).catch((err) => {
                return reply(this.boom.badRequest(err));
            });
    };

    private replySuccess = (reply, imageLocation, returnValue)=> {
        reply({
            message: 'ok',
            imageLocation: imageLocation,
            id: returnValue.id,
            rev: returnValue.rev
        });
    };

    /**
     * Get current logged on user.
     *
     * @param request
     * @param reply
     */
    private getMe = (request, reply) => {
        this.db.getUserById(request.auth.credentials._id, (err, data) => {
            if (err) {
                return reply(this.boom.badRequest(err));
            }
            reply(data);
        })
    };

    /**
     * Function to create User.
     *
     * @param request
     * @param reply
     */
    private createUser = (request, reply) => {
        // TODO: am I logged in? Can I create a new user? I don't think so
        this.db.getUserLogin(request.payload.mail).then((user) => {
            return reply(this.boom.badRequest('mail already exists'));
        }).catch((err) => {
            if (err) {
                return reply(this.boom.badRequest('something went wrong'));
            }
            this.bcrypt.genSalt(10, (err, salt) => {
                this.bcrypt.hash(request.payload.password, salt, (err, hash) => {

                    var newUser = {
                        password: hash,
                        strategy: 'default',
                        uuid: this.uuid.v4(),
                        verified: false,

                        // TODO: retrieve picture from own database
                        // dummy picture
                        picture: {
                            original: "https://achvr-assets.global.ssl.fastly.net/assets/profile_placeholder_square150-dd15a533084a90a7e8711e90228fcf60.png",
                            thumbnail: "https://achvr-assets.global.ssl.fastly.net/assets/profile_placeholder_square150-dd15a533084a90a7e8711e90228fcf60.png"
                        },
                        type: 'user'
                    };

                    // create the actual user
                    this.db.createUser(this.hoek.merge(request.payload, newUser), (err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        var userSessionData = {
                            mail: request.payload.mail,
                            _id: data.id
                        };
                        request.auth.session.set(userSessionData);
                        reply(data);

                        this.sendRegistrationMail(request.payload);
                    });
                });
            });
        });
    };

    /**
     * function to create mail information object and trigger mail.
     *
     * @param payload
     */
    private sendRegistrationMail(payload):void {
        var user = {
            name: payload.name,
            mail: payload.mail,
            uuid: payload.uuid
        };
        this.mailer.sendRegistrationMail(user);
    }

    /**
     * update user in database.
     *
     * @param request
     * @param reply
     */
    private updateUser = (request, reply) => {
        this.db.updateUser(request.params.userid, request.payload.user, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            reply(data);
        });
    };

    /**
     * Update user password of specific user.
     *
     * @param request
     * @param reply
     */
    private updateUserPassword = (request, reply) => {
        this.db.updateUserPassword(request.params.userid, request.payload.password, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            reply(data);
        });
    };

    /**
     * Update user mail of specific user.
     *
     * @param request
     * @param reply
     */
    private updateUserMail = (request, reply) => {

        // not implemented yet
        return reply(this.boom.wrap('not implemented yet',501));

        var newMail = {
            mail: request.payload.mail,
            verified: false
        };

        this.db.updateUserMail(request.params.userid, newMail, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            //TODO: send verify  mail and keep old mail address, till new mail is verified
            reply(data);
        });
    };

    /**
     * Delete user by user id.
     * @param request
     * @param reply
     */
    private deleteUser = (request, reply) => {
        if (request.params.userid != request.auth.credentials._id) {
            // unauthorized to delete other user
            return reply(this.boom.wrap(401));
        }
        this.db.deleteUserById(request.params.userid, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            request.auth.session.clear();
            reply(data);
        });
    };

    /**
     * Initialize schemas.
     */
    private initSchemas():void {
        this.userSchemaPOST = this.joi.object().keys({
            name: this.joi.string().required(),
            surname: this.joi.string().optional(),
            mail: this.joi.string().email().required(),
            password: this.joi.string().required()
        });

        // TODO: extend schema. (e.g. description text)
        this.userSchemaPUT = this.joi.object().keys({
            name: this.joi.string().optional(),
            surname: this.joi.string().optional()
        })
    }
}