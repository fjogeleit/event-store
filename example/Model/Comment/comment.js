const CommentWasWritten = require('./Event/CommentWasWritten')

const Aggregate = require('../../../dist/aggregate/aggregate').Aggregate

module.exports = class Comment extends Aggregate {
  commentId = ''
  userId = ''
  message = ''

  static write(commentId, userId, message) {
    const user = new Comment();

    user._recordThat(CommentWasWritten.with(commentId, { userId, message }).withAddedMetadata('userId', userId))

    return user;
  }

  _whenCommentWasWritten(event) {
    this.userId = event.userId;
    this.commentId = event.commentId;
    this.message = event.message;
  }

  static registeredEvents = [
    CommentWasWritten
  ]
}
