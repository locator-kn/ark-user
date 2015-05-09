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

    constructor() {
        this.register.attributes = {
            pkg: require('./../../package.json')
        };

        this.joi = require('joi');
        this.boom = require('boom');
        this.bcrypt = require('bcrypt');
        this.initSchemas();
    }

    private initSchemas():void {
        var user = this.joi.object().keys({
            name: this.joi.string().required(),
            surname: this.joi.string().required(),
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
        // route to get user
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
                handler: (request, reply) => {
                    this.bcrypt.genSalt(10, (err, salt) => {
                        this.bcrypt.hash(request.payload.password, salt, (err, hash) => {
                            request.payload.password = hash;
                            this.db.createUser(request.payload, (err, data) => {
                                if (err) {
                                    return reply(this.boom.wrap(err, 400));
                                }
                                reply(data);
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