import { AbstractAggregate, IAggregateRepository } from '../aggregate';
import { BaseEvent } from '../event';
import { createEventStore } from '../index';
import { InMemoryEventStore } from '../in-memory';
import { Driver, EventAction } from '../types';
import { Aggregate } from '../decorator';
import * as uuid from 'uuid/v4';
import { loggerMiddleware } from './logger-middleware';

class UserWasRegistered extends BaseEvent<{
  username: string;
  password: string;
}> {
  static with(aggregateId, { username, password }) {
    return this.occur(aggregateId, { username, password });
  }

  get userId() {
    return this.aggregateId;
  }

  get username() {
    return this.payload.username;
  }

  get password() {
    return this.payload.password;
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
    return this._payload.username;
  }
}

@Aggregate([UserWasRegistered, UserNameWasUpdated])
class User extends AbstractAggregate {
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

describe('middleware/logger', () => {
  let eventStore: InMemoryEventStore = null;
  let repository: IAggregateRepository<User> = null;

  beforeEach(async done => {
    eventStore = createEventStore({
      driver: Driver.IN_MEMORY,
      middleware: [{ action: EventAction.LOADED, handler: loggerMiddleware(console) }],
    });

    await eventStore.install();
    await eventStore.createStream('users');

    repository = eventStore.createRepository<User>('users', User);

    done();
  });

  it('executes the logger middleware and return unchanged events', async done => {
    const userId = uuid();

    const user = User.register(userId, 'Max', 'password').changeUsername('Maxi');

    await repository.save(user);

    const result = await repository.get(userId);

    expect(result.userId).toEqual(user.userId);
    expect(result.username).toEqual(user.username);
    expect(result.password).toEqual(user.password);

    done();
  });
});
