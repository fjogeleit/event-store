import { AbstractAggregate } from "../../../src/aggregate";
import { BaseEvent } from "../../../src";
import { Aggregate } from "../../../src/decorator";

export class CommentWasWritten extends BaseEvent<{ message: string, userId: string }> {
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

@Aggregate([CommentWasWritten])
export class Comment extends AbstractAggregate {
  commentId = '';
  userId = '';
  message = '';

  static write(commentId, userId, message) {
    const user = new Comment();

    user._recordThat(CommentWasWritten.with(commentId, { userId, message }).withAddedMetadata('userId', userId));

    return user;
  }

  _whenCommentWasWritten(event) {
    this.userId = event.userId;
    this.commentId = event.commentId;
    this.message = event.message;
  }

  static registeredEvents() {
    return [
      CommentWasWritten
    ];
  }
}
