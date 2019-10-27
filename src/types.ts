import {
  IProjection,
  IProjectionConstructor,
  IProjectionManager,
  IReadModel,
  IReadModelProjection,
  IReadModelProjectionConstructor,
  IState,
  IAggregate,
  IAggregateConstructor,
  IDateTime
} from "./types";

export enum Driver {
  POSTGRES = 'postgres',
  IN_MEMORY = 'in_memory'
}

export interface LoadStreamParameter {
  streamName: string;
  fromNumber?: number
  count?: number;
  matcher?: IMetadataMatcher;
}

export interface IEventStore {
  eventMap: AggregateEventMap

  install(): Promise<IEventStore>;
  load(streamName: string, fromNumber: number, metadataMatcher?: IMetadataMatcher): Promise<IEvent[]>;
  mergeAndLoad(...streams: Array<LoadStreamParameter>): Promise<IEvent[]>;
  appendTo(streamName: string, events: IEvent[]): Promise<void>;
  createStream(streamName: string): Promise<void>;
  hasStream(streamName: string): Promise<boolean>;
  deleteStream(streamName: string): Promise<void>;
  createProjectionManager(): IProjectionManager
  createRepository<T extends IAggregate>(
    streamName: string,
    aggregate: IAggregateConstructor<T>,
    aggregateEvents: IEventConstructor[]
  ): Repository<T>

  getProjection<T extends IState = any>(name: string): IProjection<T>
  getReadModelProjection<R extends IReadModel, T extends IState = any>(name: string): IReadModelProjection<R, T>
}

export interface AggregateEventMap {
  [aggregate: string]: IAggregateConstructor;
}

export interface WriteLockStrategy {
  createLock: (name: string) => Promise<void>
  releaseLock: (name: string) => Promise<void>
}

export interface Repository<T extends IAggregate> {
  save: (aggregate: T) => Promise<void>
  get: (aggregateId: string) => Promise<T>
}

export interface Configuration {
  connectionString: string,
  projections?: IProjectionConstructor<any>[],
  readModelProjections?: ReadModelProjectionConfiguration[],
  aggregates?: IAggregateConstructor[],
  middleware?: EventMiddleWare[]
  driver: Driver
}

export interface ReadModelProjectionConfiguration<R extends IReadModel = IReadModel, T extends IState = IState> {
  projection: IReadModelProjectionConstructor<R, T>;
  readModel: R;
}

export interface Options<D extends Driver = Driver.POSTGRES> {
  connectionString: D extends Driver.POSTGRES ? string : never,
  aggregates: IAggregateConstructor[];
  middleware: EventMiddleWare[];
  projections: IProjectionConstructor<IProjection<IState>>[];
  readModelProjections: ReadModelProjectionConfiguration[];
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
    microtime?: number
  ): IEvent;
}

export interface IEvent<T = object> {
  uuid: string;
  name: string;
  payload: T;
  metadata: EventMetadata;
  createdAt: IDateTime;

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

export interface IMetadataMatcher {
  data: MetadataMatch<MetadataOperator>[];
}

export * from './projection/types';
export * from './aggregate/types';
export * from './helper/types';
