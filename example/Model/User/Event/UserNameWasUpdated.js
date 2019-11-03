const { BaseEvent } = require('../../../../')

module.exports = class UserNameWasUpdated extends BaseEvent {
  static with(aggregateId, { username }) {
    return this.occur(aggregateId, { username });
  }

  get userId() {
    return this.aggregateId;
  }

  get username() {
    return this._payload.username
  }
}
