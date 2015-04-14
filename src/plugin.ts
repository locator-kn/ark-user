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
                    var userId = request.session.get('loggedInUser');
                    this.db.getUserById(userId, (err, data) => {
                        if (err) {
                            return reply(err).code(400);
                        }
                        reply(data);
                    })
                },
                description: 'Get all infromation about current user',
                notes: 'Identification about current logged in user is get from session parameter "loggedInUser"',
                tags: ['api', 'user']
            }
        });

        // route to get user
        server.route({
            method: 'GET',
            path: '/users/{userid}',
            handler: (request, reply) => {
                this.db.getUserById(request.params.userid, (err, data) => {
                    if (err) {
                        return reply(err).code(400);
                    }
                    reply(data);
                });
            }
        });

        // route to update user information
        server.route({
            method: 'PUT',
            path: '/users',
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
            }
        });

        // route to create new user
        server.route({
            method: 'POST',
            path: '/users',
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
            }
        });

        return 'register';
    }

    errorInit(err) {
        if (err) {
            console.log('Error: init plugin failed:', err);
        }
    }

}