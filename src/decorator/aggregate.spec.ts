import { User, UserNameWasUpdated, UserWasRegistered } from '../../test/model/user';
import { createEventStore } from '../index';
import { InMemoryEventStore } from '../in-memory';
import { Driver } from '../types';

describe('decorator/aggregate', () => {
  it('defines all possible events to the User metadata', done => {
    expect(User.registeredEvents()).toEqual([UserWasRegistered, UserNameWasUpdated]);

    const eventStore = createEventStore({
      driver: Driver.IN_MEMORY,
      connectionString: '',
    }) as InMemoryEventStore;

    expect(eventStore.eventMap).toEqual({
      [User.name]: User,
    });

    done();
  });
});
