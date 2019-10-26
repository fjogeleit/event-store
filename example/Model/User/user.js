const UserWasRegistered = require('./Event/UserWasRegistered')
const UserNameWasUpdated = require('./Event/UserNameWasUpdated')

const Aggregate = require('../../../dist/aggregate/aggregate').Aggregate

module.exports = class User extends Aggregate {
  userId = ''
  username = ''
  password = ''

  static register(userId, username, password) {
    const user = new User();

    user._recordThat(UserWasRegistered.with(userId, { username, password }))

    return user;
  }

  changeUsername(username) {
    this._recordThat(UserNameWasUpdated.with(this.userId, { username }))

    return this;
  }

  _whenUserWasRegistered(event) {
    this.userId = event.userId;
    this.username = event.username;
    this.password = event.password;
  }

  _whenUserNameWasUpdated(event) {
    this.username = event.username;
  }

  static registeredEvents = [
    UserWasRegistered,
    UserNameWasUpdated
  ]
}
