import { EventStore } from '../event-store';
import { PostgresConfiguration, PostgresOptions } from './types';
import { PostgresProjectionManager } from './projection-manager';
import { PostgresPersistenceStrategy } from './persistence-strategy';
import { IProjectionManager } from '../projection';
import { Registry } from "../registry";

export class PostgresEventStore extends EventStore {
  protected readonly _persistenceStrategy: PostgresPersistenceStrategy;
  protected _projectionManager: IProjectionManager;

  constructor(protected readonly options: PostgresOptions) {
    super(options);

    this._persistenceStrategy = new PostgresPersistenceStrategy(options);
  }

  public getProjectionManager(): IProjectionManager {
    if (!this._projectionManager) {
      this._projectionManager = new PostgresProjectionManager(this.options.connectionString, this);
    }

    return this._projectionManager;
  }
}

export const createPostgresEventStore = (configuration: PostgresConfiguration) => {
  return new PostgresEventStore({
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
