import {
  AggregateConstructor,
  AggregateEventMap,
  ELConfig,
  EventAction,
  EventCallback,
  EventStore,
  IEvent,
  LoadStreamParameter,
  MetadataMatcher
} from "./index";

import { PostgresPersistenceStrategy } from "./postgres/persistenceStrategy";
import { AggregateRepository } from "./aggregate/aggregateRepository";
import { IAggregate } from "./aggregate/types";

interface MiddlewareCollection {
  [EventAction.PRE_APPEND]: EventCallback[]
  [EventAction.APPENDED]: EventCallback[]
  [EventAction.LOADED]: EventCallback[]
}

export class PostgresEventStore implements EventStore
{
  private readonly persistenceStrategy: PostgresPersistenceStrategy;
  private readonly _eventMap: AggregateEventMap;

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
    }, this.middleware);

    this._eventMap = options.aggregates.reduce((map, config) => {
      map[config.aggregate.name] = config;

      return map;
    }, {});
  }

  get eventMap() {
    return this._eventMap
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

  public async appendTo(streamName: string, events: IEvent[]): Promise<void> {
    if (events.length === 0) return;

    events = events.map(event => {
      return this.middleware[EventAction.PRE_APPEND].reduce<IEvent>((event, handler) => {
        return handler(event);
      }, event)
    });

    await this.persistenceStrategy.appendTo(streamName, events);

    events.forEach(event => {
      return this.middleware[EventAction.APPENDED].reduce<IEvent>((event, handler) => {
        return handler(event);
      }, event)
    });
  }

  public async load(
    streamName: string,
    fromNumber: number = 0,
    metadataMatcher?: MetadataMatcher
  ): Promise<IEvent[]> {
    const events = await this.persistenceStrategy.load(streamName, fromNumber, 0, metadataMatcher);

    return events.map(event => {
      return this.middleware[EventAction.LOADED].reduce<IEvent>((event, handler) => {
        return handler(event);
      }, event)
    });
  }

  public async mergeAndLoad(streams: Array<LoadStreamParameter>) {
    const events = await this.persistenceStrategy.mergeAndLoad(streams);

    return events.map(event => {
      return this.middleware[EventAction.LOADED].reduce<IEvent>((event, handler) => {
        return handler(event);
      }, event)
    });
  }

  public hasStream(streamName: string): Promise<boolean> {
    return this.persistenceStrategy.hasStream(streamName);
  }

  public delete(streamName: string): Promise<void> {
    return this.persistenceStrategy.deleteStream(streamName);
  }

  public createRepository<T extends IAggregate>(
    streamName: string,
    aggregate: AggregateConstructor<T>
  ) {
    return new AggregateRepository<T>({
      eventStore: this,
      streamName,
      aggregate
    });
  }
}
