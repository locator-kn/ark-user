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
    mailer:any;
    uuid:any;
    imageUtil:any;
    hoek:any;
    generatePassword:any;

    constructor() {
        this.register.attributes = {
            pkg: require('./../../package.json')
        };

        this.joi = require('joi');
        this.boom = require('boom');
        this.bcrypt = require('bcrypt');
        this.uuid = require('node-uuid');
        this.imageUtil = require('locator-image-utility');
        this.hoek = require('hoek');
        this.generatePassword = require('password-generator');

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
                auth: false,
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
                auth: false,
                handler: this.getPicture,
                description: 'Get the preview picture of a user by id',
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
                    },
                    query: {
                        size: this.joi.string().valid(['medium'])
                    }
                }

            }
        });

        // Upload a profile picture
        server.route({
            method: ['POST', 'PUT'],
            path: '/users/my/picture',
            config: {
                payload: {
                    output: 'stream',
                    parse: true,
                    allow: 'multipart/form-data',
                    maxBytes: 1048576 * 6 // 6MB  TODO: discuss real value
                },
                handler: this.savePicture,
                description: 'Upload profile picture of a user',
                notes: 'The picture will be streamed and attached to the document of this user',
                tags: ['api', 'user'],
                validate: {
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
                description: 'Create/Register new user',
                notes: 'A new default location will be created for the user',
                tags: ['api', 'user'],
                validate: {
                    payload: this.userSchemaPOST
                        .required()
                        .description('User JSON object')
                }
            }
        });

        // route to create new user
        server.route({
            method: 'POST',
            path: '/users/bulk',
            config: {
                auth: false, // will be handled inside handler
                handler: this.bulkCreateUser,
                description: 'Create/Register a payload full of users',
                notes: 'A new default location will be created for each user and they will get a mail with new credentials',
                tags: ['api', 'user'],
                validate: {
                    payload: this.joi.array().items(
                        this.joi.object().keys({
                            name: this.joi.string().required(),
                            mail: this.joi.string().email().required()
                        })
                    ).required()
                }
            }
        });

        // route to update user information
        server.route({
            method: 'PUT',
            path: '/users/my/profile',
            config: {
                handler: this.updateUser,
                description: 'Update user information',
                notes: 'Update one or more properties of the user. If you want to change the password or mail,' +
                'use PUT /users/my/[password or mail]',
                tags: ['api', 'user'],
                validate: {
                    payload: this.userSchemaPUT
                        .description('User JSON object')
                }

            }
        });


        // route to update user password
        server.route({
            method: 'PUT',
            path: '/users/my/password',
            config: {
                handler: this.updateUserPassword,
                description: 'update password of user by id',
                notes: 'Important: add password as payload',
                tags: ['api', 'user'],
                validate: {
                    payload: this.joi.object().keys({
                        password: this.joi.string().required()
                    })
                }

            }
        });

        // route to update user mail
        server.route({
            method: 'PUT',
            path: '/users/my/mail',
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
                        mail: this.joi.string().required().email()
                    })
                }

            }
        });

        // delete a particular user
        server.route({
            method: 'DELETE',
            path: '/users/me',
            config: {
                handler: this.deleteUser,
                description: 'delete user "me" ',
                tags: ['api', 'trip']
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
        //TODO: limit number of result
        if (request.auth.credentials.isAdmin) {
            this.db.getUsers((err, data) => {
                if (err) {
                    return reply(this.boom.wrap(err, 400));
                }
                reply(data);
            });
        } else {
            return reply(this.boom.unauthorized());
        }
    };

    bulkCreateUser = (request, reply) => {
        if (!request.auth.credentials.isAdmin) {
            return reply(this.boom.unauthorized());
        }

        var users = request.payload;

        users.forEach(user => {
            var lowerCaseMail = user.mail.toLowerCase();
            this.db.isMailAvailable(lowerCaseMail).then(() => {

                // generate password
                var newPassword = this.generatePassword(12, false);

                this.getPasswordHash(newPassword, (err, hash) => {
                    if (err) {
                        return reply(this.boom.badRequest(err));
                    }


                    var newUser = {
                        password: hash,
                        strategy: 'default',
                        uuid: this.uuid.v4(),
                        verified: false,
                        type: 'user',
                        birthdate: '',
                        residence: '',
                        description: '',
                        mail: lowerCaseMail,
                        surname: '',
                        name: user.name
                    };

                    // create the actual user
                    this.db.createUser(newUser, (err, data) => {
                        if (err) {
                            console.error('creating new user ', newUser, 'failed: ', err);
                            return;
                        }

                        console.log('new User ', newUser, ' created');


                        this.mailer.sendRegistrationMailWithPassword({
                            name: newUser.name,
                            mail: newUser.mail,
                            password: newPassword
                        });

                        this.db.addDefaultLocationToUser(data.id)
                            .then(value => console.log('default location added', value))
                            .catch(err => console.log('error adding default location', err));
                    });
                });
            }).catch(err => console.log('error', err));

        });

        return reply('ok');

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

        var stripped = this.imageUtil.image.stripHapiRequestObject(request);

        stripped.options.id = request.auth.credentials._id;

        var imageProcessor = this.imageUtil.image.processor(stripped.options);

        if (imageProcessor.error) {
            console.log(imageProcessor);
            return reply(this.boom.badRequest(imageProcessor.error))
        }

        var metaData = imageProcessor.createFileInformation('profile');

        // crop it, scale it and return stream
        var imageStream = imageProcessor.createCroppedStream(stripped.cropping, {x: 200, y: 200});

        // crop it, scale it for thumbnail and return stream
        var thumbnailStream = imageProcessor.createCroppedStream(stripped.cropping, {x: 120, y: 120});

        // save image and return promise
        this.db.savePicture(stripped.options.id, metaData.attachmentData, imageStream)
            .then(() => {
                // save thumbnail and return promise
                metaData.attachmentData.name = metaData.thumbnailName;
                return this.db.savePicture(stripped.options.id, metaData.attachmentData, thumbnailStream);
            }).then(() => {
                // update url fields in document
                return this.db.updateDocumentWithoutCheck(stripped.options.id, {picture: metaData.imageLocation});
            }).then((value) => {
                this.replySuccess(reply, metaData.imageLocation, value)
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
        var lowerCaseMail = request.payload.mail.toLowerCase();
        this.db.isMailAvailable(lowerCaseMail).then(user => {

            this.getPasswordHash(request.payload.password, (err, hash) => {
                if (err) {
                    return reply(this.boom.badRequest(err));
                }

                // extract possiblie surname
                if (!request.payload.surname) {
                    var nameArray = request.payload.name.split(' ');
                    if (nameArray.length > 1) {
                        request.payload.surname = nameArray[nameArray.length - 1];
                        request.payload.name = nameArray.slice(0, nameArray.length - 1).join(' ')
                    }
                }


                var newUser = {
                    password: hash,
                    strategy: 'default',
                    uuid: this.uuid.v4(),
                    verified: false,
                    type: 'user',
                    birthdate: request.payload.birthdate || '',
                    residence: request.payload.residence || '',
                    description: request.payload.description || '',
                    mail: lowerCaseMail,
                    surname: request.payload.surname || '',
                    name: request.payload.name
                };

                // create the actual user
                this.db.createUser(newUser, (err, data) => {
                    if (err) {
                        return reply(this.boom.badRequest(err));
                    }
                    var userSessionData = {
                        mail: lowerCaseMail,
                        _id: data.id
                    };
                    request.auth.session.set(userSessionData);
                    reply(data);

                    this.mailer.sendRegistrationMail({
                        name: newUser.name,
                        mail: newUser.mail,
                        uuid: newUser.uuid
                    });

                    // create a default location TODO: (and trip?)
                    this.db.addDefaultLocationToUser(data.id)
                        .then(value => console.log('default location added', value))
                        .catch(err => console.log('error adding default location', err));
                });
            });
        }).catch(reply);
    };

    /**
     * update user in database.
     *
     * @param request
     * @param reply
     */
    private updateUser = (request, reply) => {
        this.db.updateUser(request.auth.credentials._id, request.payload, (err, data) => {
            if (err) {
                return reply(this.boom.badRequest(err));
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
        this.getPasswordHash(request.payload.password, (err, hash) => {
            if (err) {
                return reply(this.boom.badRequest(err));
            }
            this.db.updateUserPassword(request.auth.credentials._id, hash, (err, data) => {
                if (err) {
                    return reply(this.boom.badRequest(err));
                }
                reply(data);
            });
        });
    };

    getPasswordHash(password:string, callback) {
        this.bcrypt.genSalt(10, (err, salt) => {
            this.bcrypt.hash(password, salt, callback);
        });
    }

    /**
     * Update user mail of specific user.
     *
     * @param request
     * @param reply
     */
    private updateUserMail = (request, reply) => {

        // not implemented yet
        return reply(this.boom.wrap('not implemented yet', 501));

        var newMail = {
            mail: request.payload.mail,
            verified: false
        };

        this.db.updateUserMail(request.auth.credentials._id, newMail, (err, data) => {
            if (err) {
                return reply(this.boom.badRequest(err));
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
        this.db.deleteUserById(request.auth.credentials._id).then(value => {

            request.auth.session.clear();
            reply(value);
        }).catch(reply)

    };

    /**
     * Initialize schemas.
     */
    private initSchemas():void {
        var userSchema = this.joi.object().keys({
            name: this.joi.string(),
            mail: this.joi.string().email(),
            password: this.joi.string(),
            surname: this.joi.string().optional().allow(''),
            description: this.joi.string().optional().allow(''),
            residence: this.joi.string().optional().allow(''),
            birthdate: this.joi.date().optional().allow('')
        });

        this.userSchemaPUT = userSchema.required().min(1).description('Updating user information');

        var required = userSchema.requiredKeys('name', 'mail', 'password');
        this.userSchemaPOST = required.required().description('Registration data')

    }
}
