# User-Plugin

## Routes
####GET

|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/users/:ID   | returns profile information for requested user ID  | json object | statusCode: 404 | 
|/me           | returns profile of current user  | json object | statusCode: 404 |


####POST
|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/users   | create new user | statusCode: 200 | statusCode: 404 |

####PUT
|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/users   | update user informations  | statusCode: 200 | statusCode: 404 |
|/users/:GROUP   | add groupt to user  | statusCode: 200 | statusCode: 404 |


## Tests

Tests can be run with `npm test` or `make test`, `make test-cov` and `test-cov-html`.
Note:  `npm test` points to `make test-cov`. This is inspired from many hapi plugins.
