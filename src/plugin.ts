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
    major: string;
    picture: string;
    semester: number;
    subscribed_groups: string[];
    type: string;
}

export default
class User {
    db:any;
    joi:any;
    userSchema:any;
    boom:any;

    constructor() {
        this.register.attributes = {
            name: 'bemily-user',
            version: '0.1.0'
        };
        this.joi = require('joi');
        this.boom = require('boom');
        this.initSchema();
    }

    private initSchema():void {
        this.userSchema = this.joi.object().keys({
            _id: this.joi.string().required(),
            _rev: this.joi.string(),
            name: this.joi.string(),
            surname: this.joi.string(),
            picture: this.joi.optional(),
            mail: this.joi.string(),
            password: this.joi.string(),
            major: this.joi.string(),
            subscribed_groups: this.joi.array(),
            semester: this.joi.number().integer(),
            type: this.joi.string().required()
        });
    }

    register:IRegister = (server, options, next) => {
        server.bind(this);

        server.dependency('bemily-database', (server, next) => {
            this.db = server.plugins['bemily-database'];
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
                notes: 'Identification about current logged in user is get from session parameter "loggedInUser"',
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

        // route to update user information
        server.route({
                method: 'PUT',
                path: '/users',
                config: {
                    handler: (request, reply) => {
                        this.joi.validate(request.payload, this.userSchema, (err, user:IUser)=> {
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
                        params: {
                            user: this.userSchema
                                .required()
                                .description('User JSON object WITH _rev')
                        }

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
                    this.joi.validate(request.payload, this.userSchema, (err, user:IUser)=> {
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
                    params: {
                        user: this.userSchema
                            .required()
                            .description('User JSON object')
                    }

                }

            }}
        );

        return 'register';
    }

    errorInit(err) {
        if (err) {
            console.log('Error: init plugin failed:', err);
        }
    }

}