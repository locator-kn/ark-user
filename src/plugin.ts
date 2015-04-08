export interface IRegister {
    (server:any, options:any, next:any): void;
    attributes?: any;
}

export default
class User {
    constructor() {
        this.register.attributes = {
            name: 'bemily-user',
            version: '0.1.0',
            dependencies: 'bemily-database'
        };
    }

    register:IRegister = (server, options, next) => {
        server.bind(this);
        this._register(server, options);
        next();
    };

    private _register(server, options) {
        // Register
        server.route({
            method: '*',
            path: '/test',
            handler: (request, reply) => {
                reply(request.server.plugins['bemily-database'].getUser());
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