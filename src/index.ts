import { Pool } from "pg";
import { PostgresEventStore } from "./eventStore";
import { PostgresWriteLockStrategy } from "./postgres/writeLockStrategy";
import { AggregateRepository } from "./aggregate/aggregateRepository";
import { Projection, ProjectionConstructor, ProjectionManager, State } from "./projection/types";
import { IAggregate } from "./aggregate/types";

export const EVENT_STREAMS_TABLE = 'event_streams';
export const PROJECTIONS_TABLE = 'projections';

export enum Driver {
  POSTGRES = 'postgres'
}

export interface LoadStreamParameter {
  streamName: string;
  fromNumber: number
  count?: number;
  matcher?: MetadataMatcher;
}

export interface EventStore {
  eventMap: AggregateEventMap

  install(): Promise<EventStore>;
  load(streamName: string, fromNumber: number, metadataMatcher?: MetadataMatcher): Promise<IEvent[]>;
  mergeAndLoad(streams: Array<LoadStreamParameter>): Promise<IEvent[]>;
  appendTo(streamName: string, events: IEvent[]): Promise<void>;
  createStream(streamName: string): Promise<void>;
  hasStream(streamName: string): Promise<boolean>;
  deleteStream(streamName: string): Promise<void>;
  createProjectionManager(): ProjectionManager
  createRepository<T extends IAggregate>(
    streamName: string,
    aggregate: AggregateConstructor<T>,
    aggregateEvents: IEventConstructor[]
  ): Repository<T>

  getProjection<T extends State = any>(name: string): Projection<T>
}

export interface AggregateEventMap {
  [aggregate: string]: AggregateConstructor;
}

export interface WriteLockStrategy {
  createLock: (name: string) => Promise<void>
  releaseLock: (name: string) => Promise<void>
}

export interface RepositoryConfiguration<T> {
  eventStore: EventStore;
  aggregate: AggregateConstructor<T>;
  events: IEventConstructor[];
  streamName: string;
}

export interface Repository<T extends IAggregate> {
  save: (aggregate: T) => Promise<void>
  get: (aggregateId: string) => Promise<T>
}

export interface Configuration<D extends Driver = Driver.POSTGRES> {
  connectionString: D extends Driver.POSTGRES ? string : never,
  projections?: ProjectionConstructor<Projection<any>>[],
  aggregates?: AggregateConstructor[],
  middleware?: EventMiddleWare[]
}

export interface Options {
  client: Pool;
  aggregates: AggregateConstructor[];
  middleware: EventMiddleWare[];
  writeLock: WriteLockStrategy;
  projections: ProjectionConstructor<Projection<any>>[];
}

export interface EventMetadata {
  _aggregate_id: string;
  _aggregate_type: string;
  _aggregate_version: number;
  [label: string]: any;
}

export interface IEventConstructor<T = object> {
  new (
    _eventName: string,
    _payload: T,
    _metadata: EventMetadata,
    _uuid?: string,
    _createdAt?: Date
  ): IEvent;
}

export interface AggregateConstructor<T = object> {
  new (): T;
  registeredEvents: IEventConstructor[];
}

export interface IEvent<T = object> {
  uuid: string;
  name: string;
  payload: T;
  metadata: EventMetadata;
  createdAt: Date

  withVersion(version: number): IEvent<T>
  withAggregateType(type: string): IEvent<T>
  withMetadata(metadata: EventMetadata): IEvent<T>
}

export enum EventAction {
  PRE_APPEND = 'PRE_APPEND',
  APPENDED = 'APPENDED',
  LOADED = 'LOADED',
}

export type EventCallback = (event: IEvent) => IEvent;

export interface EventMiddleWare {
  action: EventAction
  handler: EventCallback
}

export enum MetadataOperator {
   EQUALS = '=',
   GREATER_THAN = '>',
   GREATER_THAN_EQUALS = '>=',
   IN = 'in',
   LOWER_THAN = '<',
   LOWER_THAN_EQUALS = '<=',
   NOT_EQUALS = '!=',
   NOT_IN = 'nin',
   REGEX = 'regex'
}

export enum FieldType {
  METADATA= 'metadata',
  MESSAGE_PROPERTY = 'message_property'
}

export interface MetadataMatch<T extends MetadataOperator> {
  field: string;
  value: T extends MetadataOperator.IN ? Array<string | number | Date> : T extends MetadataOperator.NOT_IN ? Array<string | number | Date> : string | number | Date | boolean;
  operation: T;
  fieldType: FieldType;
}

export interface MetadataMatcher {
  data: MetadataMatch<MetadataOperator>[];
}

export const createEventStore = ({ connectionString, aggregates, projections, middleware }: Configuration) => {
  const client = new Pool({ connectionString });

  return new PostgresEventStore({
    client,
    writeLock: new PostgresWriteLockStrategy(client),
    aggregates: aggregates || [],
    middleware: middleware || [],
    projections: projections || []
  });
};

export * from './event'
