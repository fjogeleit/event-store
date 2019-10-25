import { EventStore } from '../eventStore'
import { IProjectionManager } from '../projection/types'
import { PostgresProjectionManager } from './projectionManager'
import { Options } from "../index";
import { PostgresPersistenceStrategy } from "./persistenceStrategy";

export class PostgresEventStore extends EventStore
{
  protected readonly persistenceStrategy;

  constructor(protected readonly options: Options) {
    super(options);

    this.persistenceStrategy = new PostgresPersistenceStrategy(options);
  }

  public createProjectionManager(): IProjectionManager {
    return new PostgresProjectionManager(this.options.connectionString, this);
  }
}
