import { UserNameWasUpdated, UserWasRegistered } from '../../test/model/user';
import { createInMemoryEventStore } from '../in-memory';
import { AbstractReadModel, AbstractReadModelProjection } from '../projection';
import { ReadModelProjection } from './read-model-projection';

class UserTableReadModel extends AbstractReadModel {
  private _readModel: {
    [userId: string]: { username: string; password: string };
  };

  constructor() {
    super();
  }

  async init() {
    this._readModel = {};
  }

  async isInitialized() {
    return !!this._readModel;
  }

  async reset() {
    this._readModel = {};
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

@ReadModelProjection({
  name: 'user_table',
  readModel: new UserTableReadModel(),
})
class UserTableProjection extends AbstractReadModelProjection<UserTableReadModel, {}> {
  public project() {
    return this.projector
      .fromStream({ streamName: 'users' })
      .init(() => ({}))
      .when({
        [UserWasRegistered.name]: (state, event: UserWasRegistered) => {
          this.readModel.stack('insert', event.userId, {
            id: event.userId,
            username: event.username,
            password: event.password,
          });

          return state;
        },
        [UserNameWasUpdated.name]: (state, event: UserNameWasUpdated) => {
          this.readModel.stack('update', event.userId, {
            username: event.username,
          });

          return state;
        },
      });
  }
}

describe('decorator/projection', () => {
  it('finds decorated projections and add the defined name to the constructor', done => {
    const eventStore = createInMemoryEventStore();

    const projector = eventStore.getReadModelProjector<UserTableReadModel, {}>('user_table');

    expect(projector).not.toBeNull();
    expect((projector.constructor as any).name).toEqual('InMemoryReadModelProjector');

    done();
  });
});
