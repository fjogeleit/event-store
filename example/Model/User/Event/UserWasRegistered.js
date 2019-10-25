const { BaseEvent } = require('../../../../dist')

module.exports = class UserWasRegistered extends BaseEvent {
  static with(aggregateId, { username, password }) {
    return this.occur(aggregateId, { username, password });
  }

  get userId() {
    return this.aggregateId;
  }

  get username() {
    return this.payload.username
  }

  get password() {
    return this.payload.password
  }
}
