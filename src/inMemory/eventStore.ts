import { EventStore } from '../eventStore'
import { IProjectionManager } from '../projection/types'
import { IEvent, Options } from "../index";
import { InMemoryPersistenceStrategy } from "./persistenceStrategy";
import { InMemoryProjectionManager } from "./projectionManager";

export class InMemoryEventStore extends EventStore
{
  protected readonly persistenceStrategy;

  constructor(protected readonly options: Options) {
    super(options);

    this.persistenceStrategy = new InMemoryPersistenceStrategy(options);
  }

  get eventStreams(): { [streamName: string]: IEvent<any>[] } {
    return this.persistenceStrategy.eventStreams;
  }

  public createProjectionManager(): IProjectionManager {
    return new InMemoryProjectionManager(this);
  }
}
