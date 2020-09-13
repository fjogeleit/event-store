import { FieldType, IEvent, MetadataOperator } from '../types';
import { createSqliteEventStore } from '../sqlite';
import { SqliteEventStore } from './event-store';
import * as uuid from 'uuid/v4';
import { User } from '../../test/model/user';
import { Comment } from '../../test/model/comment';

const iterableToArray = async (iterator: AsyncIterable<any>): Promise<any[]> => {
  const array = [];

  for await (const item of iterator) {
    array.push(item);
  }

  return array;
};

describe('sqlLite/eventStore', () => {
  let eventStore: SqliteEventStore = null;

  beforeAll(async next => {
    eventStore = createSqliteEventStore({ connectionString: ':memory:' });

    await eventStore.install();

    next();
  });

  afterEach(async (next) => {
    await eventStore.deleteStream('users').catch(console.warn);
    await eventStore.deleteStream('comments').catch(console.warn);

    next()
  })

  it('createStream creates a new SqliteMemory stream without errors', async done => {
    await eventStore.createStream('users');

    expect(await eventStore.hasStream('users')).toBe(true);

    done();
  });

  it('deleteStream removes only the expected stream', async done => {
    await eventStore.createStream('users');
    await eventStore.createStream('comments');

    expect(await eventStore.hasStream('users')).toBe(true);
    expect(await eventStore.hasStream('comments')).toBe(true);

    await eventStore.deleteStream('comments');

    expect(await eventStore.hasStream('comments')).toBe(false);

    done();
  });

  it('hasStream returns TRUE for existing streams ', async done => {
    await eventStore.createStream('users');
    await eventStore.createStream('comments');

    expect(await eventStore.hasStream('users')).toBe(true);

    done();
  });

  it('hasStream returns FALSE for none existing streams ', async done => {
    await eventStore.createStream('users');

    expect(await eventStore.hasStream('comments')).toBeFalsy();

    done();
  });

  it('persist and load array of user events', async done => {
    const user = User.register(uuid(), 'Tony', 'Tester').changeUsername('Tommy');

    const events = user.popEvents();

    await eventStore.createStream('users');
    await eventStore.appendTo('users', events);

    const loaded = (await iterableToArray(await eventStore.load('users')));

    expect(loaded.length).toEqual(2);

    expect(loaded.map(event => event.uuid)).toEqual(events.map(event => event.uuid));

    done();
  });

  it('load user events fromNumber', async done => {
    const user = User.register(uuid(), 'Tony', 'Tester').changeUsername('Tommy');

    const [registered, nameChanged] = user.popEvents();

    await eventStore.createStream('users');
    await eventStore.appendTo('users', [registered, nameChanged]);

    const events = await eventStore.load('users', 2);

    for await (const loadedNameChangeEvent of events) {
      expect(loadedNameChangeEvent.uuid).toEqual(nameChanged.uuid);
    }

    done();
  });

  it('load user events filtered by metaMatcher <event_name>', async done => {
    const user = User.register(uuid(), 'Tony', 'Tester')
      .changeUsername('Tommy')
      .changeUsername('Harald');

    const events = user.popEvents();

    await eventStore.createStream('users');
    await eventStore.appendTo('users', events);

    const storeEvents = await eventStore.load('users', 1, {
      data: [
        {
          fieldType: FieldType.MESSAGE_PROPERTY,
          field: 'event_name',
          operation: MetadataOperator.EQUALS,
          value: 'UserNameWasUpdated',
        },
      ],
    });

    const history = await iterableToArray(storeEvents);

    const [ChangedToTommy, ChangedToHarald, ...rest] = history;

    expect(rest.length).toEqual(0);
    expect(ChangedToTommy.name).toEqual('UserNameWasUpdated');
    expect(ChangedToTommy.name).toEqual('UserNameWasUpdated');

    done();
  });

  it('load both streams and merge them in historical order', async done => {
    const user = User.register(uuid(), 'Tony', 'Tester').changeUsername('Tommy');

    const comment = Comment.write(uuid(), user.userId, 'first commit');

    user.changeUsername('Harald');

    const userEvents = user.popEvents();

    await eventStore.createStream('users');
    await eventStore.appendTo('users', userEvents);

    const commentEvents = comment.popEvents();

    await eventStore.createStream('comments');
    await eventStore.appendTo('comments', commentEvents);

    const storeEvents = await eventStore.mergeAndLoad(
      { streamName: 'users' },
      { streamName: 'comments' }
    );

    const history = await iterableToArray(storeEvents);

    const [UserRegistered, NameChangedToTommy, CommentWasWritten, NameChangedToHarald] = history;

    expect(UserRegistered.constructor.name).toEqual('UserWasRegistered');
    expect((NameChangedToTommy as IEvent<{ username: string }>).payload.username).toEqual('Tommy');
    expect(CommentWasWritten.constructor.name).toEqual('CommentWasWritten');
    expect((NameChangedToHarald as IEvent<{ username: string }>).payload.username).toEqual('Harald');

    done();
  });
});
