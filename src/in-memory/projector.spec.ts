import { Driver, IProjector } from '../types';
import { createEventStore } from '../index';
import { InMemoryEventStore } from './event-store';
import { IAggregateRepository } from '../types';
import * as uuid from 'uuid/v4';
import { User } from '../../test/model/user';
import { UserListProjection } from '../../test/projection/UserList';

describe('inMemory/projector', () => {
  let eventStore: InMemoryEventStore = null;
  let projector: IProjector<Array<{ username: string; id: string }>> = null;
  let repository: IAggregateRepository<User> = null;

  beforeEach(async next => {
    eventStore = createEventStore({
      driver: Driver.IN_MEMORY,
      connectionString: '',
    }) as InMemoryEventStore;

    await eventStore.install();
    await eventStore.createStream('users');
    projector = await eventStore.getProjector(UserListProjection.projectionName);
    repository = eventStore.createRepository<User>('users', User);

    next();
  });

  it('should return a projector instance', done => {
    expect(projector).not.toBeNull();

    done();
  });

  it('should return a projected user list', async done => {
    const tommyId = uuid();

    const tommy = User.register(tommyId, 'Tony', 'Tester').changeUsername('Tommy');

    const paulId = uuid();

    const paul = User.register(paulId, 'Paul', 'Panzer');

    await repository.save(tommy);
    await repository.save(paul);

    await projector.run(false);

    expect(Object.values(projector.getState())).toEqual([
      { id: tommyId, username: 'Tommy', password: 'Tester' },
      { id: paulId, username: 'Paul', password: 'Panzer' },
    ]);

    done();
  });

  it('reset should return a empty state', async done => {
    const tommyId = uuid();

    const tommy = User.register(tommyId, 'Tony', 'Tester').changeUsername('Tommy');

    const paulId = uuid();

    const paul = User.register(paulId, 'Paul', 'Panzer');

    await repository.save(tommy);
    await repository.save(paul);

    await projector.run(false);
    await projector.reset();
    await projector.reset();

    const state = projector.getState();

    expect(state).toEqual({});

    done();
  });

  it('delete should return the init state', async done => {
    const tommyId = uuid();

    const tommy = User.register(tommyId, 'Tony', 'Tester').changeUsername('Tommy');

    const paulId = uuid();

    const paul = User.register(paulId, 'Paul', 'Panzer');

    await repository.save(tommy);
    await repository.save(paul);

    await projector.run(false);
    await projector.delete(false);

    const state = projector.getState();

    expect(state).toEqual({});

    done();
  });
});
