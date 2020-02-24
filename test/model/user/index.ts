import { Aggregate } from "../../../src/decorator";
import { AbstractAggregate } from "../../../src/aggregate";
import { BaseEvent } from "../../../src";

export class UserWasRegistered extends BaseEvent<{ username: string, password: string }> {
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

export class UserNameWasUpdated extends BaseEvent<{ username: string }> {
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

@Aggregate([
  UserWasRegistered,
  UserNameWasUpdated
])
export class User extends AbstractAggregate {
  userId = '';
  username = '';
  password = '';

  public static register(userId, username, password) {
    const user = new User();

    user._recordThat(UserWasRegistered.with(userId, { username, password }));

    return user;
  }

  public changeUsername(username) {
    this._recordThat(UserNameWasUpdated.with(this.userId, { username }));

    return this;
  }

  protected _whenUserWasRegistered(event) {
    this.userId = event.userId;
    this.username = event.username;
    this.password = event.password;
  }

  protected _whenUserNameWasUpdated(event) {
    this.username = event.username;
  }
}
