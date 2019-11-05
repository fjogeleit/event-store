import { EventStore } from '../event-store';
import { Options } from '../';
import { MysqlProjectionManager } from './projection-manager';
import { MysqlPersistenceStrategy } from './persistence-strategy';
import { IProjectionManager } from '../projection';

export class MysqlEventStore extends EventStore {
  protected readonly _persistenceStrategy;
  protected _projectionManager;

  constructor(protected readonly options: Options) {
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
