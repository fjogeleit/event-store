import {
  IAggregateConstructor,
  AggregateEventMap,
  Options,
  EventAction,
  EventCallback,
  IEventStore,
  IEvent,
  LoadStreamParameter,
  MetadataMatcher
} from "./index";

import { AggregateRepository } from "./aggregate/aggregateRepository";
import { IAggregate } from "./aggregate/types";
import {
  IProjection,
  IProjectionConstructor,
  IProjectionManager, IReadModel,
  IReadModelProjection,
  State
} from "./projection/types";

interface MiddlewareCollection {
  [EventAction.PRE_APPEND]: EventCallback[]
  [EventAction.APPENDED]: EventCallback[]
  [EventAction.LOADED]: EventCallback[]
}

export interface PersistenceStrategy {
  createEventStreamsTable(): Promise<void>
  createProjectionsTable(): Promise<void>
  addStreamToStreamsTable(streamName: string): Promise<void>
  removeStreamFromStreamsTable(streamName: string): Promise<void>
  deleteStream(streamName: string): Promise<void>
  createSchema(streamName: string): Promise<void>
  dropSchema(streamName: string): Promise<void>
  appendTo<T = object>(streamName: string, events: IEvent<T>[]): Promise<void>
  load(streamName: string, fromNumber: number, count?: number, matcher?: MetadataMatcher): Promise<IEvent[]>
  mergeAndLoad(streams: Array<LoadStreamParameter>): Promise<IEvent[]>
  hasStream(streamName: string): Promise<boolean>
  deleteStream(streamName: string): Promise<void>
}

export abstract class EventStore implements IEventStore
{
  protected readonly _eventMap: AggregateEventMap;
  protected readonly abstract persistenceStrategy: PersistenceStrategy;

  protected readonly middleware: MiddlewareCollection = {
    [EventAction.PRE_APPEND]: [],
    [EventAction.APPENDED]: [],
    [EventAction.LOADED]: []
  };

  protected constructor(protected readonly options: Options) {
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
    fromNumber: number = 1,
    metadataMatcher?: MetadataMatcher
  ): Promise<IEvent[]> {
    const events = await this.persistenceStrategy.load(streamName, fromNumber, undefined, metadataMatcher);

    return events.map(event => {
      return this.middleware[EventAction.LOADED].reduce<IEvent>((event, handler) => {
        return handler(event);
      }, event)
    });
  }

  public async mergeAndLoad(...streams: LoadStreamParameter[]) {
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
    aggregate: IAggregateConstructor<T>
  ) {
    return new AggregateRepository<T>({
      eventStore: this,
      streamName,
      aggregate
    });
  }

  public abstract createProjectionManager(): IProjectionManager;

  public getProjection<T extends State = any>(name: string): IProjection<T> {
    const Projection = this.options.projections.find((projection) => projection.projectionName === name);

    if (!Projection) {
      throw new Error(`A Projection with name ${name} does not exists`);
    }

    return new (Projection as any)(this.createProjectionManager())
  }

  public getReadModelProjection<R extends IReadModel, T extends State = any>(name: string): IReadModelProjection<R, T> {
    const { projection: ReadModelProjection, readModel} = this.options.readModelProjections.find(({ projection }) => projection.projectionName === name);

    if (!ReadModelProjection) {
      throw new Error(`A Projection with name ${name} does not exists`);
    }

    return new (ReadModelProjection as any)(this.createProjectionManager(), readModel);
  }
}
