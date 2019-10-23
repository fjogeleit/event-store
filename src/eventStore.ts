import {
  AggregateConstructor,
  AggregateEventMap,
  Options,
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
import { PostgresProjectionManager } from "./postgres/projectionManager";
import { Projection, ProjectionManager, State } from "./projection/types";

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

  constructor(private readonly options: Options) {
    this.persistenceStrategy = new PostgresPersistenceStrategy(this.options);

    this.middleware = (this.options.middleware || []).reduce<MiddlewareCollection>((carry, middleware) => {
      carry[middleware.action].push(middleware.handler);

      return carry;
    }, this.middleware);

    this._eventMap = (options.aggregates || []).reduce((map, aggregate) => {
      map[aggregate.name] = aggregate;

      return map;
    }, {});
  }

  get eventMap() {
    return this._eventMap
  }

  public async install() {
    await this.persistenceStrategy.createEventStreamsTable();
    await this.persistenceStrategy.createProjectionsTable();

    return this;
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

  public deleteStream(streamName: string): Promise<void> {
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

  public createProjectionManager(): ProjectionManager {
    return new PostgresProjectionManager(this.options.client, this);
  }

  public getProjection<T extends State = any>(name: string): Projection<T> {
    const Projection = this.options.projections.find((projection) => projection.projectionName === name);

    if (!Projection) {
      throw new Error(`A Projection with name ${name} does not exists`);
    }

    return new Projection(this.createProjectionManager());
  }
}
