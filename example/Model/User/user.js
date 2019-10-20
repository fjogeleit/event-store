const UserWasRegistered = require('./Event/UserWasRegistered')

module.exports = class User {
  userId = ''
  username = ''
  password = ''

  _version = 0;
  _events = [];

  static register(userId, username, password) {
    const user = new User();

    user._recordThat(UserWasRegistered.with(userId, { username, password }))

    return user;
  }

  _whenUserWasRegistered(event) {
    this.userId = event.userId;
    this.username = event.username;
    this.password = event.password;
  }

  _recordThat(event) {
    this._version += 1;

    event = event
      .withVersion(this._version)
      .withAggregateType(this.constructor.name);

    this._events.push(event)
    this._apply(event)
  }

  _apply(event) {
    const method = `_when${event.constructor.name}`;

    if (method in this) {
      this[method](event)
    }
  }

  _replay(event) {
    this._version = event.version;
    this._apply(event);

    return this;
  }

  static fromHistory(events) {
    return events.reduce((user, event) => {
      return user._replay(event)
    }, new User())
  }
}
