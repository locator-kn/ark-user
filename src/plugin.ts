export interface IRegister {
    (server:any, options:any, next:any): void;
    attributes?: any;
}

/**
 * structure of user in database
 */
export interface IUser {
    _id: string;
    _rev?: string;
    name: string;
    surname: string;
    mail: string;
    password: string;
    picture: string;
    type: string;
}

export default
class User {
    db:any;
    joi:any;
    userSchemaPOST:any;
    userSchemaPUT:any;
    boom:any;

    constructor() {
        this.register.attributes = {
            name: 'backend-user',
            version: '0.1.0'
        };
        this.joi = require('joi');
        this.boom = require('boom');
        this.initSchemas();
    }

    private initSchemas():void {
        var user = this.joi.object().keys({
            _id: this.joi.string().required(),
            name: this.joi.string().required(),
            surname: this.joi.string().required(),
            picture: this.joi.optional(),
            mail: this.joi.string().email().required(),
            password: this.joi.string().required(),
            type: this.joi.string().required().valid('user')
        });

        var rev = this.joi.object().keys({_rev: this.joi.string().required()});

        this.userSchemaPOST = user;
        this.userSchemaPUT = rev.concat(user);

    }

    register:IRegister = (server, options, next) => {
        server.bind(this);

        server.dependency('backend-database', (server, next) => {
            this.db = server.plugins['backend-database'];
            next();
        });


        this._register(server, options);
        next();
    };

    private _register(server, options) {
        // get user information about logged in user
        server.route({
            method: 'GET',
            path: '/me',
            config: {
                handler: (request, reply) => {
                    if(!request.auth || !request.auth.credentials) {
                        return reply(this.boom.badRequest('this should never happen'));
                    }
                    this.db.getUserById(request.auth.credentials.id, (err, data) => {
                        if (err) {
                            return reply(err).code(400);
                        }
                        reply(data);
                    })
                },
                description: 'Get all information about current user',
                notes: 'Identification about current logged in user is get from session parameter "loggedInUser"' +
                'Not testable with "hapi-swagger" plugin',
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

        // route to update user information
        server.route({
                method: 'PUT',
                path: '/users',
                config: {
                    handler: (request, reply) => {
                        this.joi.validate(request.payload, this.userSchemaPUT, (err, user:IUser)=> {
                            if (err) {
                                return reply(this.boom.wrap(err, 400, err.details.message));
                            } else {
                                this.db.updateUser(user._id, user._rev, user, (err, data) => {
                                    if (err) {
                                        return reply(this.boom.wrap(err, 400));
                                    }
                                    reply(data);
                                });

                            }
                        });
                    },
                    description: 'Update user information',
                    notes: 'It is important to add the "_rev" property!',
                    tags: ['api', 'user'],
                    validate: {
                        payload: this.userSchemaPUT
                            .required()
                            .description('User JSON object WITH _rev')
                    }

                }
            }
        );

        // route to create new user
        server.route({
                method: 'POST',
                path: '/users',
                config: {
                    handler: (request, reply) => {
                        this.joi.validate(request.payload, this.userSchemaPOST, (err, user:IUser)=> {
                            if (err) {
                                return reply(this.boom.wrap(err, 400, err.details.message));
                            } else {
                                this.db.createUser(user, (err, data) => {
                                    if (err) {
                                        return reply(this.boom.wrap(err, 400, err.details.message));
                                    }
                                    reply(data);
                                });

                            }
                        });
                    },
                    description: 'Create new user',
                    notes: 'Create with _id (from LDAP) and without _rev',
                    tags: ['api', 'user'],
                    validate: {
                        payload: this.userSchemaPOST
                            .required()
                            .description('User JSON object')
                    }

                }
            }
        );

        return 'register';
    }

    errorInit(err) {
        if (err) {
            console.log('Error: init plugin failed:', err);
        }
    }

}