const { AbstractReadModelProjection, AbstractReadModel } = require('../../')

const UserWasRegistered = require('../model/user/event/user-was-registered')
const UserNameWasUpdated = require('../model/user/event/user-name-was-updated')

const USER_TABLE = `app_users`;

class UserTableReadModel extends AbstractReadModel {
  /**
   * @param {MySQLClient} client
   */
  constructor(client) {
    super();
    this.client = client;
  }

  async init() {
    await this.client.connection.query(`
        CREATE TABLE ${USER_TABLE} (
            id VARCHAR(50) NOT NULL,
            username VARCHAR(255) NOT NULL,
            password VARCHAR(255) NOT NULL,
            PRIMARY KEY (id)
        );
    `);
  }

  async isInitialized() {
    return await this.client.exists(USER_TABLE);
  }

  async reset() {
    await this.client.reset(USER_TABLE);
  }

  async delete() {
    await this.client.delete(USER_TABLE);
  }

  async insert(values) {
    await this.client.insert(USER_TABLE, values);
  }

  async update(values, identifiers) {
    await this.client.update(USER_TABLE, values, identifiers);
  }

  async remove(identifiers) {
    await this.client.remove(USER_TABLE, identifiers);
  }
}

class UserTableProjection extends AbstractReadModelProjection {
  static projectionName = 'table_users';

  project() {
    return this.projector
      .fromStream({ streamName: 'users' })
      .init(() => ({}))
      .when({
        [UserWasRegistered.name]: (state, event) => {
          this.readModel.stack('insert', { id: event.userId, username: event.username, password: event.password });

          return state;
        },
        [UserNameWasUpdated.name]: (state, event) => {
          this.readModel.stack('update', { username: event.username }, { id: event.userId });

          return state;
        }
      });
  }
}

module.exports = {
  UserTableProjection,
  UserTableReadModel
}
