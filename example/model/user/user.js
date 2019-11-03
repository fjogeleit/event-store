const UserWasRegistered = require('./event/user-was-registered')
const UserNameWasUpdated = require('./event/user-name-was-updated')

const { AbstractAggregate } = require('../../../')

module.exports = class User extends AbstractAggregate {
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

  static registeredEvents() {
    return [
      UserWasRegistered,
      UserNameWasUpdated
    ];
  }
}
