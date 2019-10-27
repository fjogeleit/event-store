import { Aggregate } from "../aggregate/aggregate";
import { BaseEvent } from "../event";
import { AggregateConfig } from "./aggregate";
import { createEventStore } from "../index";
import { InMemoryEventStore } from "../inMemory/eventStore";
import { Driver } from "../types";

class UserWasRegistered extends BaseEvent<{ username: string, password: string }> {
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

class UserNameWasUpdated extends BaseEvent<{ username: string }> {
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

@AggregateConfig([
  UserWasRegistered,
  UserNameWasUpdated
])
class User extends Aggregate {
  userId = '';
  username = '';
  password = '';

  public static register(userId, username, password) {
    const user = new User();

    user._recordThat(UserWasRegistered.with(userId, { username, password }))

    return user;
  }

  public changeUsername(username) {
    this._recordThat(UserNameWasUpdated.with(this.userId, { username }))

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

describe('decorator/aggregate', () => {
  it('defines all possible events to the User metadata', (done) => {
    expect(User.registeredEvents()).toEqual([UserWasRegistered, UserNameWasUpdated]);

    const eventStore = createEventStore({
      driver: Driver.IN_MEMORY,
      connectionString: ''
    }) as InMemoryEventStore;

    expect(eventStore.eventMap).toEqual({
      [User.name]: User
    });

    done()
  })
});
