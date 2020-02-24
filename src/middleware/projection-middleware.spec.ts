import { AbstractAggregate } from '../aggregate';
import { BaseEvent } from '../event';
import { createInMemoryEventStore } from '../in-memory';
import { EventAction, IEventStore } from '../types';
import { Aggregate, Projection } from '../decorator';
import * as uuid from 'uuid/v4';
import { projectionMiddleware } from './projection-middleware';
import { AbstractProjection } from '../projection';

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

@Projection('projection_users')
class UserListProjection extends AbstractProjection<{
  [userId: string]: { username: string };
}> {
  project(keepRunning = false) {
    return this.projector
      .fromStream({ streamName: 'users' })
      .init(() => ({}))
      .when({
        [UserNameWasUpdated.name]: (state, event: UserNameWasUpdated) => {
          state[event.userId] = { username: event.username };

          return state;
        },
      });
  }
}

describe('middleware/projection', () => {
  it("doens't executes when no registered events are appended", async done => {
    const eventStore = createInMemoryEventStore({
      middleware: [{ action: EventAction.APPENDED, handler: projectionMiddleware() }],
    });

    await eventStore.install();
    await eventStore.createStream('users');

    const repository = eventStore.createRepository<User>('users', User);

    const userId = uuid();

    const user = User.register(userId, 'Max', 'password');

    await repository.save(user);

    const projector = eventStore.getProjector<UserListProjection>('projection_users');

    expect(projector.getState()).toEqual({});

    done();
  });

  it('executes on registered events', async done => {
    const projectionComplete = (eventStore: IEventStore) => {
      const projector = eventStore.getProjector<{
        [userId: string]: { username: string };
      }>('projection_users');

      expect(projector.getState()).toEqual({ [userId]: { username: 'Maxi' } });

      done();
    };

    const eventStore = createInMemoryEventStore({
      middleware: [
        {
          action: EventAction.APPENDED,
          handler: projectionMiddleware(projectionComplete),
        },
      ],
    });

    await eventStore.install();
    await eventStore.createStream('users');

    const repository = eventStore.createRepository<User>('users', User);

    const userId = uuid();

    const user = User.register(userId, 'Max', 'password').changeUsername('Maxi');

    await repository.save(user);
  });
});
