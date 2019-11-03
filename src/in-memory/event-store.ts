import { EventStore } from '../event-store';
import { IEvent, Options } from '../';
import { InMemoryPersistenceStrategy, InMemoryProjectionManager } from './';
import { IProjectionManager } from '../projection';

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
