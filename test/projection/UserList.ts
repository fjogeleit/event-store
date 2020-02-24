import { AbstractProjection } from "../../src/projection";
import { UserNameWasUpdated, UserWasRegistered } from "../model/user";
import { Projection } from "../../src/decorator";

@Projection('projection_users')
export class UserListProjection extends AbstractProjection {
  project() {
    return this.projector
      .fromStream({ streamName: 'users' })
      .init(() => ({}))
      .when({
        [UserWasRegistered.name]: (state, event: UserWasRegistered) => {
          state[event.userId] = { id: event.userId, username: event.username, password: event.password };

          return state;
        },
        [UserNameWasUpdated.name]: (state, event: UserNameWasUpdated) => {
          state[event.userId].username = event.username;

          return state;
        }
      });
  }
}
