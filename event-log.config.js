require('dotenv').config({
  path: 'example/.env'
})

const User = require('./example/Model/User/user')
const Comment = require('./example/Model/Comment/comment')
const UserListProjection = require('./example/Projection/userList')

module.exports = {
  connectionString: process.env.POSTGRES_CONNECTION,
  aggregates: [
    User,
    Comment
  ],

  projections: [
    UserListProjection
  ]
}
