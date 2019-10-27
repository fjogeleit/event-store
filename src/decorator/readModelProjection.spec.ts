import { Aggregate } from "../aggregate/aggregate";
import { BaseEvent } from "../event";
import { AggregateConfig } from "./aggregate";
import { createEventStore } from "../index";
import { InMemoryEventStore } from "../inMemory/eventStore";
import { IProjectionConstructor } from "../projection/types";
import { ReadModel } from "../projection/readModel";
import { ReadModelProjection } from "../projection/readModelProjection";
import { ReadModelProjectionConfig } from "./readModelProjection";
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

class UserTableReadModel extends ReadModel {
  private _readModel: { [userId: string]: { username: string, password: string } };

  constructor() {
    super();
  }

  async init() {
    this._readModel = {}
  }

  async isInitialized() {
    return !!this._readModel
  }

  async reset() {
    this._readModel = {}
  }

  async delete() {
    this._readModel = undefined;
  }

  async insert(id, values) {
    this._readModel[id] = values;
  }

  async update(id, values) {
    this._readModel[id] = { ...this._readModel[id], ...values };
  }

  async remove(id) {
    delete this._readModel[id];
  }

  get result() {
    return this._readModel;
  }
}

@ReadModelProjectionConfig({
  name: 'user_table',
  readModel: new UserTableReadModel()
})
class UserTableProjection extends ReadModelProjection<UserTableReadModel, {}> {
  async run(keepRunning = false) {
    await this.projector
      .fromStream({ streamName: 'users' })
      .init(() => ({}))
      .when({
        [UserWasRegistered.name]: (state, event: UserWasRegistered) => {
          this.readModel.stack('insert', event.userId, { id: event.userId, username: event.username, password: event.password });

          return state;
        },
        [UserNameWasUpdated.name]: (state, event: UserNameWasUpdated) => {
          this.readModel.stack('update', event.userId, { username: event.username });

          return state;
        }
      })
      .run(keepRunning);

    return Object.values(this.readModel.result || {});
  }
}

describe('decorator/projection', () => {
  it('finds decorated projections and add the defined name to the constructor', (done) => {
    const eventStore = createEventStore({
      driver: Driver.IN_MEMORY,
      connectionString: ''
    }) as InMemoryEventStore;

    const projection = eventStore.getReadModelProjection<UserTableProjection>('user_table');

    expect(projection).not.toBeNull();
    expect((projection.constructor as IProjectionConstructor).projectionName).toEqual('user_table');

    done()
  })
});
