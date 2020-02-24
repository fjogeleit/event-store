import { EventStore } from '../event-store';
import { IEvent, Options } from '../';
import { InMemoryPersistenceStrategy, InMemoryProjectionManager, InMemoryConfiguration } from './';
import { IProjectionManager } from '../projection';
import { Registry } from "../registry";

export class InMemoryEventStore extends EventStore {
  protected readonly _persistenceStrategy;
  protected _projectionManager;

  constructor(protected readonly options: Options) {
    super(options);

    this._persistenceStrategy = new InMemoryPersistenceStrategy(options);
  }

  get eventStreams(): { [streamName: string]: IEvent<any>[] } {
    return this._persistenceStrategy.eventStreams;
  }

  public getProjectionManager(): IProjectionManager {
    if (!this._projectionManager) {
      this._projectionManager = new InMemoryProjectionManager(this);
    }

    return this._projectionManager;
  }
}

export const createInMemoryEventStore = (configuration: InMemoryConfiguration = {}) => {
  return new InMemoryEventStore({
    middleware: configuration.middleware || [],
    registry: new Registry(
      configuration.aggregates || [],
      [],
      configuration.projections || [],
      configuration.readModelProjections || []
    ),
  });
};
