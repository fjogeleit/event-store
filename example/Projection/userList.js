const { AbstractProjection } = require('../../')

const UserWasRegistered = require('../Model/User/Event/UserWasRegistered')
const UserNameWasUpdated = require('../Model/User/Event/UserNameWasUpdated')

module.exports = class UserListProjection extends AbstractProjection {
  static projectionName = 'projection_users';

  project() {
    return this.projector
      .fromStream({ streamName: 'users' })
      .init(() => ({}))
      .when({
        [UserWasRegistered.name]: (state, event) => {
          state[event.userId] = { id: event.userId, username: event.username, password: event.password };

          return state;
        },
        [UserNameWasUpdated.name]: (state, event) => {
          state[event.userId].username = event.username;

          return state;
        }
      });
  }
}
