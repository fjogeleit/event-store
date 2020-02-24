import { EventStore } from '../event-store';
import { MysqlProjectionManager } from './projection-manager';
import { MysqlPersistenceStrategy } from './persistence-strategy';
import { IProjectionManager } from '../projection';
import { MysqlConfiguration, MysqlOptions } from './types';
import { Registry } from "../registry";

export class MysqlEventStore extends EventStore {
  protected readonly _persistenceStrategy;
  protected _projectionManager;

  constructor(protected readonly options: MysqlOptions) {
    super(options);

    this._persistenceStrategy = new MysqlPersistenceStrategy(options);
  }

  public getProjectionManager(): IProjectionManager {
    if (!this._projectionManager) {
      this._projectionManager = new MysqlProjectionManager(this.options.connection, this);
    }

    return this._projectionManager;
  }
}

export const createMysqlEventStore = (configuration: MysqlConfiguration) => {
  return new MysqlEventStore({
    connection: configuration.connection,
    middleware: configuration.middleware || [],
    registry: new Registry(
      configuration.aggregates || [],
      [],
      configuration.projections || [],
      configuration.readModelProjections || []
    ),
  });
};
