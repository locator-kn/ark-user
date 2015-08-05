export interface IRegister {
    (server:any, options:any, next:any): void;
    attributes?: any;
}

import {initLogging, log, logError} from './util/logging'

declare var Promise;
var http = require('https');
var fse = require('fs-extra');
var path = require('path');

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
    generatePassword:any;
    data:any;

    constructor() {
        this.register.attributes = {
            pkg: require('./../../package.json')
        };

        this.joi = require('joi');
        this.boom = require('boom');
        this.bcrypt = require('bcrypt');
        this.uuid = require('node-uuid');
        this.imageUtil = require('locator-image-utility');
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

        // set dependency to the database plugin
        server.dependency('ark-staticdata', (server, next) => {
            this.data = server.plugins['ark-staticdata'];
            next();
        });

        this._register(server, options);
        this._registerSeneca(server, options);
        initLogging(server);
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
                handler: (request, reply) => {
                    return reply(this.db.getUserById(request.params.userid));
                },
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
        server.route({
            method: 'GET',
            path: '/users/{userid}/{name}.{ext}',
            config: {
                auth: false,
                handler: (request, reply) => {
                    var documentId = request.params.userid;
                    var size = request.query.size || request.query.s;

                    if (!size) {
                        // return biggest picture if no size is given
                        return reply(this.db.getPicture(documentId, this.imageUtil.size.user.name));
                    } else {
                        return reply(this.db.getPicture(documentId, size));
                    }
                },
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
                    query: this.joi.object().keys({
                        size: this.joi.string().valid([
                            this.imageUtil.size.user.name,
                            this.imageUtil.size.userThumb.name
                        ]),
                        s: this.joi.string().valid([
                            this.imageUtil.size.user.name,
                            this.imageUtil.size.userThumb.name
                        ])
                    }).unknown()
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
                    maxBytes: 1048576 * 6 // 6MB
                },
                handler: (request, reply) => {

                    this.data.uploadImage(request, 'user')
                        .then((value:any) => {
                            return reply(value).created(value.imageLocation);
                        }).catch(reply);

                },
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
                handler: (request, reply) => {
                    return reply(this.db.getUserById(request.auth.credentials._id));
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
                handler: (request, reply) => {
                    reply(this.db.updateUser(request.auth.credentials._id, request.payload))
                },
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


    _registerSeneca = (server, options) => {
        var id = 0;

        // Add a Seneca action

        var id = 0;
        server.seneca.add({create: 'user'}, function (message, next) {


            return next(null, {id: ++id});
        });


        server.seneca.add({create: 'user', strategy: 'default'}, (message, next) => {

            var newUser = message.user;

            // create the actual user
            this.db.createUser(newUser)
                .then(data => {

                    // strange error: res === data, but data produces an error
                    var res = {
                        ok: true,
                        id: data.id,
                        rev: data.rev
                    };
                    next(null, res);


                    server.seneca.act({send: 'registrationMail', user: newUser});
                    server.seneca.act({send: 'slackNofification', user: newUser});
                    server.seneca.act({send: 'chatWelcomeMessage', user: newUser});


                    // create a default location
                    this.db.addDefaultLocationToUser(data.id)
                        .then(value => console.log('default location added', value))
                        .catch(err => console.log('error adding default location', err));


                }).catch(err => next(null, err));

        });

        server.seneca.add({create: 'user', strategy: 'facebook'}, (message, next) => {


            return next(null, {res: message.strategy});
        });

        server.seneca.add({create: 'user', strategy: 'google'}, (message, next)=> {


            return next(null, {res: message.strategy});
        });

        server.seneca.add({send: 'slackNofification'}, (message, next)=> {

            // send slack notif
            this.sendSlackNotification(message.user);
            return next(null, {ok: true});
        });

        server.seneca.add({send: 'registrationMail'}, (message, next)=> {

            var newUser = message.user;
            this.mailer.sendRegistrationMail({
                name: newUser.name,
                mail: newUser.mail,
                uuid: newUser.uuid
            });
            return next(null, {ok: true});
        });

        server.seneca.add({send: 'sendRegistrationMailWithoutUuid'}, (message, next)=> {

            var newUser = message.user;
            this.mailer.sendRegistrationMailWithoutUuid({
                name: newUser.name,
                mail: newUser.mail,
            });
            return next(null, {ok: true});
        });

        server.seneca.add({send: 'chatWelcomeMessage'}, (message, next)=> {

            // send chat message
            this.sendChatWelcomeMessage(message.user);
            return next(null, {ok: true});
        });


    };

    /**
     * Handler function to get all user.
     *
     * @param request
     * @param reply
     */
    getUsers = (request, reply) => {
        if (request.auth.credentials.isAdmin) {
            return reply(this.db.getUsers());
        } else {
            return reply(this.boom.unauthorized());
        }
    };

    bulkCreateUser = (request, reply) => {
        if (!request.auth.credentials || !request.auth.credentials.isAdmin) {
            return reply(this.boom.unauthorized());
        }

        var users = request.payload;
        var i = users.length;

        // delay creating the user
        var intervalID = setInterval(() => {
            if (i <= 0) {
                clearInterval(intervalID);
                return;
            }
            i = i - 1;

            // capitalize first character of name
            var name = users[i].name;
            users[i].name = name.charAt(0).toUpperCase() + name.slice(1);

            // create the user
            this.bulkcreateSingleUser(users[i]);

        }, 2000);


        return reply('ok');

    };

    private bulkcreateSingleUser = (user) => {
        var lowerCaseMail = user.mail.toLowerCase();
        var newPassword;

        // check first if mail is already taken
        this.db.isMailAvailable(lowerCaseMail)
            .then(() => {
                // generate password and hash
                newPassword = this.generatePassword(12, false);
                return this._getPasswordHash(newPassword)
            }).then(hash => {
                // create the actual user
                return this.db.createUser({
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
                })
            }).then(data => {

                // send welcome mail
                this.mailer.sendRegistrationMailWithPassword({
                    name: user.name,
                    mail: lowerCaseMail,
                    password: newPassword
                });

                // add default location
                this.db.addDefaultLocationToUser(data.id)
                    .then(value => console.log('default location added', value))
                    .catch(err => console.log('error adding default location', err));

                // send slack notif
                this.sendSlackNotification({
                    name: user.name,
                    mail: lowerCaseMail
                });

                // send chat message
                this.sendChatWelcomeMessage(data)
            }).catch(err => logError('error' + err));
    };

    /**
     * Function to create User.
     *
     * @param request
     * @param reply
     */
    private createUser = (request, reply) => {
        var lowerCaseMail = request.payload.mail.toLowerCase();
        var newUser:any = {};

        // first check if mail is not taken
        this.db.isMailAvailable(lowerCaseMail)
            .then(() => {
                // generate Password hash
                return this._getPasswordHash(request.payload.password)
            }).catch(err => {
                if (err.isBoom) {
                    return Promise.reject(err)
                }
                // password hash generation failed
                logError('password hash generation failed' + err);
                return Promise.reject(this.boom.badRequest('unable to create password hash'))
            }).then(hash => {

                // extract possiblie surname
                if (!request.payload.surname) {
                    var nameArray = request.payload.name.split(' ');
                    if (nameArray.length > 1) {
                        request.payload.surname = nameArray[nameArray.length - 1];
                        request.payload.name = nameArray.slice(0, nameArray.length - 1).join(' ')
                    }
                }

                newUser = {
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


                request.seneca.act({create: 'user', strategy: 'default', user: newUser}, (err, res) => {

                    if (err) {
                        return reply(err)
                    }

                    // set sessiondata
                    request.auth.session.set({
                        mail: newUser.mail,
                        _id: res.id,
                        strategy: 'default'
                    });

                    return reply(res);
                });

            }).catch(reply);
    };


    /**
     * Update user password of specific user.
     *
     * @param request
     * @param reply
     */
    private updateUserPassword = (request, reply) => {
        this._getPasswordHash(request.payload.password)
            .then(hash => {

                return reply(this.db.updateUserPassword(request.auth.credentials._id, hash));
            }).catch(err => {
                if (err.isBoom) {
                    return reply(err);
                }
                // password hash generation failed
                logError('password hash generation failed' + err);
                return reply(this.boom.badRequest('unable to create password hash'));
            })

    };


    /**
     * Returns a promise and when resolved the hash to the corresponding password
     * @param password
     * @private
     */
    _getPasswordHash = (password:string) => {
        return new Promise((resolve, reject) => {

            this.bcrypt.genSalt(10, (err, salt) => {

                if (err) {
                    return reject(err);
                }
                this.bcrypt.hash(password, salt, (err, hash) => {

                    if (err) {
                        return reject(err);
                    }
                    resolve(hash)
                });
            });
        })
    };

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

        return reply(this.db.updateUserMail(request.auth.credentials._id, newMail));
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

    private sendSlackNotification = (user) => {

        var slackNotification = {
            text: "Woop! New User: " + user.name + ' ' + user.mail
        };

        var body = JSON.stringify(slackNotification);

        var headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
        };

        var options = {
            host: 'hooks.slack.com',
            path: '/services/T04E7N144/B06DFA7ML/e8LSbACRrOP82d4z8EqtbOOE',
            method: 'POST',
            headers: headers
        };

        var request = http.request(options, function (res) {
            res.setEncoding('utf-8');

            var responseString = '';

            res.on('data', function (data) {
                responseString += data;
            });

            res.on('end', function () {
                log('Response after sending slack notification: ' + responseString);
            });

        });

        request.write(body);
        request.end();

    };

    //send initial chat message
    private sendChatWelcomeMessage = (user) => {
        var messageDocument:any = {};
        var defaultMessages = fse.readJsonSync(path.resolve(__dirname, './staticdata/chatMessage.json'), 'utf-8');

        var me = 'locator-app';
        var opp = user.id;


        var conversation = {
            user_1: me,
            user_2: opp,
            type: 'conversation'
        };
        conversation[me + '_read'] = true;
        conversation[opp + '_read'] = false;

        this.db.createConversation(conversation)
            .then(value => {
                messageDocument = {
                    conversation_id: value.id,
                    from: 'locator_app',
                    to: user.id,
                    message: defaultMessages.message1,
                    timestamp: Date.now(),
                    type: 'message'
                };
                return this.db.saveMessage(messageDocument)
            }).then(() => {
                messageDocument.message = defaultMessages.message2;
                return this.db.saveMessage(messageDocument)
            }).then(() => {
                messageDocument.message = defaultMessages.message3;
                this.db.saveMessage(messageDocument)
            }).catch(err => logError('error while sending chat messages' + err))


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
