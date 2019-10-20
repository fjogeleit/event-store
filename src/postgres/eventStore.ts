import { ELConfig, EventAction, EventCallback, EventMiddleWare, EventStore, IEvent, MetadataMatcher } from "../index";
import { PostgresPersistenceStrategy } from "./persistenceStrategy";

interface MiddlewareCollection {
  [EventAction.PRE_APPEND]: EventCallback[]
  [EventAction.APPENDED]: EventCallback[]
  [EventAction.LOADED]: EventCallback[]
}

export class PostgresEventStore implements EventStore
{
  private readonly persistenceStrategy: PostgresPersistenceStrategy;

  private readonly middleware: MiddlewareCollection = {
    [EventAction.PRE_APPEND]: [],
    [EventAction.APPENDED]: [],
    [EventAction.LOADED]: []
  };

  constructor(private readonly options: ELConfig) {
    this.persistenceStrategy = new PostgresPersistenceStrategy(this.options);

    this.middleware = (this.options.middleware || []).reduce<MiddlewareCollection>((carry, middleware) => {
      carry[middleware.action].push(middleware.handler);

      return carry;
    }, this.middleware)
  }

  public async install() {
    await this.persistenceStrategy.createEventStreamsTable();
    await this.persistenceStrategy.createProjectionsTable();
  }

  public async createStream(streamName: string) {
    await this.persistenceStrategy.addStreamToStreamsTable(streamName);

    try {
      await this.persistenceStrategy.createSchema(streamName);
    } catch (error) {
      await this.persistenceStrategy.dropSchema(streamName);
      await this.persistenceStrategy.removeStreamFromStreamsTable(streamName);

      throw error
    }
  }

  public async appendTo(streamName: string, events: IEvent[]): Promise<IEvent[]> {
    if (events.length === 0) return;

    events = events.map(event => {
      return this.middleware[EventAction.PRE_APPEND].reduce<IEvent>((event, handler) => {
        return handler(event);
      }, event)
    });

    await this.persistenceStrategy.appendTo(streamName, events);

    return events.map(event => {
      return this.middleware[EventAction.APPENDED].reduce<IEvent>((event, handler) => {
        return handler(event);
      }, event)
    });
  }

  public async load(streamName: string, fromNumber: number = 0, metadataMatcher?: MetadataMatcher) {
    const events = await this.persistenceStrategy.load(streamName, fromNumber, 0, metadataMatcher)

    return events.map(event => {
      return this.middleware[EventAction.LOADED].reduce<IEvent>((event, handler) => {
        return handler(event);
      }, event)
    });
  }
}
