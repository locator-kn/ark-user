export interface IRegister {
    (server:any, options:any, next:any): void;
    attributes?: any;
}

export default
class User {
    constructor() {
        this.register.attributes = {
            name: 'bemily-user',
            version: '0.1.0'
        };
    }

    register:IRegister = (server, options, next) => {
        server.bind(this);
        this._register(server, options);
        next();
    };

    private _register(server, options) {
        // Register
        return 'register';
    }
}