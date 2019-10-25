require('dotenv').config({
  path: 'example/.env'
})

const User = require('./example/Model/User/user')
const Comment = require('./example/Model/Comment/comment')
const UserListProjection = require('./example/Projection/userList')
const { UserTableProjection, UserTableReadModel } = require('./example/Projection/userTable')
const { SQLClient } = require('./dist/helper/postgres')
const { Pool } = require('pg')

const connection = new Pool({ connectionString: process.env.POSTGRES_CONNECTION });

module.exports = {
  connectionString: process.env.POSTGRES_CONNECTION,
  aggregates: [
    User,
    Comment
  ],

  projections: [
    UserListProjection
  ],

  readModelProjections: [
    {
      projection: UserTableProjection,
      readModel: new UserTableReadModel(new SQLClient(connection))
    }
  ]
}
