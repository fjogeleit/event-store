import { User, UserNameWasUpdated, UserWasRegistered } from '../../test/model/user';
import { createInMemoryEventStore } from '../in-memory';

describe('decorator/aggregate', () => {
  it('defines all possible events to the User metadata', done => {
    expect(User.registeredEvents()).toEqual([UserWasRegistered, UserNameWasUpdated]);

    const eventStore = createInMemoryEventStore({});

    expect(eventStore.eventMap).toEqual({
      [User.name]: User,
    });

    done();
  });
});
