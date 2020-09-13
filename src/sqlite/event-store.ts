import { EventStore } from '../event-store';
import { SqliteProjectionManager } from './projection-manager';
import { SqlitePersistenceStrategy } from './persistence-strategy';
import { IProjectionManager } from '../projection';
import { SqliteConfiguration, SqliteOptions } from './types';
import { Registry } from "../registry";

export class SqliteEventStore extends EventStore {
  protected readonly _persistenceStrategy;
  protected _projectionManager;

  constructor(protected readonly options: SqliteOptions) {
    super(options);

    this._persistenceStrategy = new SqlitePersistenceStrategy(options);
  }

  public getProjectionManager(): IProjectionManager {
    if (!this._projectionManager) {
      this._projectionManager = new SqliteProjectionManager(this.options.connectionString, this);
    }

    return this._projectionManager;
  }

  public close() {
    this._persistenceStrategy.close();
  }
}

export const createSqliteEventStore = (configuration: SqliteConfiguration) => {
  return new SqliteEventStore({
    connectionString: configuration.connectionString,
    middleware: configuration.middleware || [],
    registry: new Registry(
      configuration.aggregates || [],
      [],
      configuration.projections || [],
      configuration.readModelProjections || []
    ),
  });
};
