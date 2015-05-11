# User

### Routes
####GET

|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/users           | returns all users  | json object | statusCode: 404 |
|/users/:userID | returns profile information for requested user ID  | json object | statusCode: 404 | 
|/users/me           | returns profile of current user  | json object | statusCode: 404 |


####POST
|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/users           | create new user  | statusCode: 200 | statusCode: 404 |

####PUT
|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/users/me   | update user information  | statusCode: 200 | statusCode: 404 |
|/users/me/password   | update user password  | statusCode: 200 | statusCode: 404 |
|/users/:userID/password | update password of user by id  | statusCode: 200 | statusCode: 404 |
|/users/:userID | update particular user  | statusCode: 200 | statusCode: 404 | 

####DELETE
|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/users/:userID | delete user by userid  | statusCode: 200 | statusCode: 404 | 






### Dummy Json Results
```
{
   _id: '4234324342',
   _rev: '1-dbe58c4eb46dc66b3b62ed4dfab2f3fe',
   picture: 'data:image/jpeg;base64,/9j/4QAY...',
   name: 'Doe',
   surname: 'John',
   description: 'Ich bin Steffen Ich bin Steffen, Steffen wollt ich schon immer sein',
   mail: 'john.doe@info.de',
   password: 'secret',
   type: 'user'
}
 

```

