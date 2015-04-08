export interface IRegister {
    (server:any, options:any, next:any): void;
    attributes?: any;
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
        // Register
        server.route({
            method: '*',
            path: '/test',
            handler: (request, reply) => {
                reply(this.db.getUser());
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