import { createSqliteEventStore } from '../sqlite';
import { SqliteEventStore } from './event-store';
import * as uuid from 'uuid/v4';
import { User } from '../../test/model/user';
import { UserListProjection } from '../../test/projection/UserList';
import { IAggregateRepository, IProjector } from '../index';

describe('sqlLite/projector', () => {
  let eventStore: SqliteEventStore = null;
  let projector: IProjector<Array<{ username: string; id: string }>> = null;
  let repository: IAggregateRepository<User> = null;

  beforeAll(async next => {
    eventStore = createSqliteEventStore({ connectionString: ':memory:' });

    await eventStore.install();
    await eventStore.createStream('users');
    projector = await eventStore.getProjector(UserListProjection.projectionName);
    repository = eventStore.createRepository<User>('users', User);

    next();
  });

  afterEach(async (next) => {
    await eventStore.deleteStream('users').catch(console.warn);
    await eventStore.createStream('users').catch(console.warn);

    next()
  })

  it('should return a projector instance', async done => {
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
