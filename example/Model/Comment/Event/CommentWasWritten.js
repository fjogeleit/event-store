const BaseEvent = require('../../../../dist').BaseEvent

module.exports = class CommentWasWritten extends BaseEvent {
  static with(aggregateId, { userId, message }) {
    return this.occur(aggregateId, { userId, message });
  }

  get commentId() {
    return this.aggregateId;
  }

  get message() {
    return this._payload.message
  }

  get userId() {
    return this._payload.userId
  }
}
