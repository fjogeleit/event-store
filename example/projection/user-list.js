const { AbstractProjection } = require('../../')

const UserWasRegistered = require('../model/user/event/user-was-registered')
const UserNameWasUpdated = require('../model/user/event/user-name-was-updated')

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
