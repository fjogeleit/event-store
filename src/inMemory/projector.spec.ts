import { Driver, IEvent } from "../types";
import { createEventStore } from "../index";
import { InMemoryEventStore } from "./eventStore";
import { IAggregate } from "../../dist/aggregate/types";
import { Projection } from "../projection";
import { IProjection, IAggregateConstructor, Repository } from "../types";
import * as uuid from "uuid/v4";


interface IUser extends IAggregate {
  userId: string;
  username: string;
  password: string;

  changeUsername(username: string): IUser;
}

interface IUserConstructor extends IAggregateConstructor<IUser> {
  userId: string;
  commentId: string;
  message: string;

  register(userId: string, username: string, password: string): IUser
}

interface IUserWasRegisteredConstructor {
  new(): IUserWasRegistered
}

interface IUsernameWasChangedConstructor {
  new(): IUsernameWasChanged
}

interface IUserWasRegistered extends IEvent {
  username: string;
  password: string;
  userId: string;
}

interface IUsernameWasChanged extends IEvent {
  username: string;
  userId: string;
}

const User: IUserConstructor = require('../../example/Model/User/user');
const UserWasRegistered: IUserWasRegisteredConstructor = require('../../example/Model/User/Event/UserWasRegistered');
const UserNameWasUpdated: IUsernameWasChangedConstructor = require('../../example/Model/User/Event/UserNameWasUpdated');

class UserListProjection extends Projection<{ [userId: string ]: { username: string, id: string } }> {
  static projectionName = 'projection_users';

  async run(keepRunning = false) {
    await this.projector
      .fromStream({ streamName: 'users' })
      .init(() => ({}))
      .when({
        [UserWasRegistered.name]: (state, event: IUserWasRegistered) => {
          state[event.userId] = { id: event.userId, username: event.username };

          return state;
        },
        [UserNameWasUpdated.name]: (state, event: IUsernameWasChanged) => {
          state[event.userId].username = event.username;

          return state;
        }
      })
      .run(keepRunning);

    return Object.values(this.projector.getState() || {});
  }
}

describe('inMemory/projector', () => {
  let eventStore: InMemoryEventStore = null;
  let projection: IProjection<Array<{ username: string, id: string }>> = null;
  let repository: Repository<IUser> = null;

  beforeEach(async (next) => {
    eventStore = createEventStore({
      driver: Driver.IN_MEMORY,
      connectionString: '',
      aggregates: [User],
      projections: [
        UserListProjection
      ]
    }) as InMemoryEventStore;

    await eventStore.install();
    await eventStore.createStream('users');
    projection = await eventStore.getProjection(UserListProjection.projectionName);
    repository = eventStore.createRepository<IUser>('users', User);

    next();
  });

  it('should return a projection instance', (done) => {
    expect(projection).not.toBeNull();

    done();
  });

  it('should return a projected user list', async (done) => {
    const tommyId = uuid();

    const tommy = User
      .register(tommyId, 'Tony', 'Tester')
      .changeUsername('Tommy');

    const paulId = uuid();

    const paul = User
      .register(paulId, 'Paul', 'Panzer');

    await repository.save(tommy);
    await repository.save(paul);

    const list = await projection.run(false);

    expect(list).toEqual([{ username: 'Tommy', id: tommyId }, { id: paulId, username: 'Paul' }]);

    done();
  });

  it('reset should return a empty state', async (done) => {
    const tommyId = uuid();

    const tommy = User
      .register(tommyId, 'Tony', 'Tester')
      .changeUsername('Tommy');

    const paulId = uuid();

    const paul = User
      .register(paulId, 'Paul', 'Panzer');

    await repository.save(tommy);
    await repository.save(paul);

    await projection.run(false);
    await projection.reset();
    await projection.reset();

    const state = projection.getState();

    expect(state).toEqual({});

    done();
  });

  it('delete should return the init state', async (done) => {
    const tommyId = uuid();

    const tommy = User
      .register(tommyId, 'Tony', 'Tester')
      .changeUsername('Tommy');

    const paulId = uuid();

    const paul = User
      .register(paulId, 'Paul', 'Panzer');

    await repository.save(tommy);
    await repository.save(paul);

    await projection.run(false);
    await projection.delete(false);

    const state = projection.getState();

    expect(state).toEqual({});

    done();
  });
});
