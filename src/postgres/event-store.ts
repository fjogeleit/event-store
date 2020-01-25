import { EventStore } from '../event-store';
import { PostgresProjectionManager } from './projection-manager';
import { PostgresPersistenceStrategy } from './persistence-strategy';
import { IProjectionManager } from '../projection';
import { PostgresOptions } from '../types';

export class PostgresEventStore extends EventStore {
  protected readonly _persistenceStrategy;
  protected _projectionManager;

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
