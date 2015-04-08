export interface IRegister {
    (server:any, options:any, next:any): void;
    attributes?: any;
}

/**
 * structure of user in database
 */
export interface User {
    _id: string;
    name: string;
    surname: string;
    mail: string;
    password: string;
    username: string;
    major: string;
    semester: number;
    subscribed_groups: string[];
}

export default
class User {
    db: any;
    constructor() {
        this.register.attributes = {
            name: 'bemily-user',
            version: '0.1.0'
        };
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
            handler: (request, reply) => {
                var userId = request.session.get('loggedInUser');
                this.db.getUserById(userId, (err, data:User) => {
                    if(err) {
                        return reply(err).code(400);
                    }
                    reply(data);
                })
            }
        });
        return 'register';
    }

    errorInit(error) {
        if(error) {
            console.log('Error: init plugin failed:', error);
        }
    }
}