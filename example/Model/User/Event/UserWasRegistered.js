const DomainEvent = require('../../../../dist').DomainEvent

module.exports = class UserWasRegistered extends DomainEvent {
  static with(aggregateId, { username, password }) {
    return new UserWasRegistered(aggregateId, { username, password })
  }

  get userId() {
    return this._metadata._aggregate_id;
  }

  get username() {
    return this.payload.username
  }

  get password() {
    return this.payload.password
  }
}
