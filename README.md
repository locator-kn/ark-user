# User

### Routes
####GET

|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/users           | returns all users  | json object | statusCode: 404 |
|/users/:userID | returns profile information for requested user ID  | json object | statusCode: 404 | 
|/users/me           | returns profile of current user  | json object | statusCode: 404 |
|/users/:userID/:file.:ext  | returns the profile picture of the user with the requested ID  | image stream | statusCode: 404 |


####POST
|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/users           | create new user  | statusCode: 200 | statusCode: 404 |
|/users/:userID/picture     | create a new profile picture  | json object with the destination of the picture | statusCode: 404 |

####PUT
|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/users/me   | update user information  | statusCode: 200 | statusCode: 404 |
|/users/me/password   | update user password  | statusCode: 200 | statusCode: 404 |
|/users/:userID/password | update password of user by id  | statusCode: 200 | statusCode: 404 |
|/users/:userID | update particular user  | statusCode: 200 | statusCode: 404 | 
|/users/:userID/picture     | update the profile picture  | json object with the destination of the picture | statusCode: 404 |

####DELETE
|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/users/:userID | delete user by userid  | statusCode: 200 | statusCode: 404 | 






### Dummy Json Results
 - Getting a user
```
{
   _id: '4234324342',
   _rev: '1-dbe58c4eb46dc66b3b62ed4dfab2f3fe',
   name: 'Doe',
   surname: 'John',
   description: 'Ich bin Steffen Ich bin Steffen, Steffen wollt ich schon immer sein',
   "imageLocation": {
     "picture": "/i/users/368f5b48e4f45213ed912dd1e30377df/profile.png",
     "thumbnail": "/i/users/368f5b48e4f45213ed912dd1e30377df/profile-thumb.png"
   },
   mail: 'john.doe@info.de',
   password: 'secret',
   type: 'user'
}
```

 - Creating/Updating a profile picture
```
 {
   "message": "ok",
   "imageLocation": {
     "picture": "/i/users/368f5b48e4f45213ed912dd1e30377df/profile.png",
     "thumbnail": "/i/users/368f5b48e4f45213ed912dd1e30377df/profile-thumb.png"
   }
 }
```

>  "/i" in the url will be transformed to /api/vX/ from nginx on the server side

