const User = require('./example/model/user/user')
const Comment = require('./example/model/comment/comment')
const UserListProjection = require('./example/projection/user-list')
const { UserTableProjection, UserTableReadModel } = require('./example/projection/user-table')

module.exports = {
  driver: 'mysql',
  connectionString: 'postgres://user:password@localhost/event-store',
  connection: {
    user: 'user',
    password: 'password',
    host: 'localhost',
    database: 'event-store'
  },
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
      readModel: UserTableReadModel
    }
  ]
}
