import { Aggregate } from "../aggregate/aggregate";
import { BaseEvent } from "../event";
import { AggregateConfig } from "./aggregate";
import { createEventStore } from "../index";
import { InMemoryEventStore } from "../inMemory/eventStore";
import { Projection } from "../projection/projection";
import { ProjectionConfig } from "./projection";
import { IProjectionConstructor } from "../projection/types";
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

@ProjectionConfig('user_list')
class UserListProjection extends Projection<{ [userId: string]: { username: string, id: string, password: string } }> {
  async run(keepRunning = false): Promise<Array<{ username: string, id: string, password: string }>> {
    await this.projector
      .fromStream({ streamName: 'users' })
      .init(() => ({}))
      .when({
        [UserWasRegistered.name]: (state, event: UserWasRegistered) => {
          state[event.userId] = { id: event.userId, username: event.username, password: event.password };

          return state;
        },
        [UserNameWasUpdated.name]: (state, event: UserNameWasUpdated) => {
          state[event.userId].username = event.username;

          return state;
        }
      })
      .run(keepRunning);

    return Object.values(this.projector.getState() || {});
  }
}


describe('decorator/projection', () => {
  it('finds decorated projections and add the defined name to the constructor', (done) => {
    const eventStore = createEventStore({
      driver: Driver.IN_MEMORY,
      connectionString: ''
    }) as InMemoryEventStore;

    const projection = eventStore.getProjection<UserListProjection>('user_list');

    expect(projection).not.toBeNull();
    expect((projection.constructor as IProjectionConstructor).projectionName).toEqual('user_list');

    done()
  })
});
