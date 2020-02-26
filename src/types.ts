import {
  IProjectionConstructor,
  IProjectionManager,
  IProjector,
  IReadModel,
  IReadModelProjectionConstructor,
  IReadModelProjector,
  IState,
} from './projection';
import { IDateTime } from './helper';
import { IAggregate, IAggregateConstructor, IAggregateRepository } from './aggregate';
import { Registry } from './registry';

export enum Driver {
  POSTGRES = 'postgres',
  IN_MEMORY = 'in_memory',
  MYSQL = 'mysql',
}

export interface LoadStreamParameter {
  streamName: string;
  fromNumber?: number;
  count?: number;
  matcher?: IMetadataMatcher;
}

export interface IEventStore {
  eventMap: AggregateEventMap;
  registeredProjections: string[];

  install(): Promise<IEventStore>;
  load(streamName: string, fromNumber: number, metadataMatcher?: IMetadataMatcher): Promise<AsyncIterable<IEvent>>;
  mergeAndLoad(...streams: Array<LoadStreamParameter>): Promise<AsyncIterable<IEvent>>;
  appendTo(streamName: string, events: IEvent[]): Promise<void>;
  createStream(streamName: string): Promise<void>;
  hasStream(streamName: string): Promise<boolean>;
  deleteStream(streamName: string): Promise<void>;
  getProjectionManager(): IProjectionManager;
  createRepository<T extends IAggregate>(streamName: string, aggregate: IAggregateConstructor<T>): IAggregateRepository<T>;
  getProjector<T extends IState = any>(name: string): IProjector<T>;
  getReadModelProjector<R extends IReadModel, T extends IState>(name: string): IReadModelProjector<R, T>;
}

export interface AggregateEventMap {
  [aggregate: string]: IAggregateConstructor;
}

export interface WriteLockStrategy {
  createLock: (name: string) => Promise<boolean>;
  releaseLock: (name: string) => Promise<boolean>;
}

export interface Configuration {
  projections?: IProjectionConstructor<any>[];
  readModelProjections?: ReadModelProjectionConfiguration[];
  aggregates?: IAggregateConstructor[];
  middleware?: EventMiddleWare[];
}

export interface ReadModelProjectionConfiguration<R extends IReadModel = IReadModel, T extends IState = IState> {
  projection: IReadModelProjectionConstructor<R, T>;
  readModel: R;
}

export interface Options {
  middleware: EventMiddleWare[];
  registry: Registry;
}

export interface EventMetadata {
  _aggregate_id: string;
  _aggregate_type: string;
  _aggregate_version: number;
  [label: string]: any;
}

export interface IEventConstructor<T = object> {
  new (_eventName: string, _payload: T, _metadata: EventMetadata, _uuid?: string, microtime?: number, no?: number): IEvent;
}

export interface IEvent<T = object> {
  no: number;
  uuid: string;
  name: string;
  payload: T;
  metadata: EventMetadata;
  createdAt: IDateTime;

  withVersion(version: number): IEvent<T>;
  withAggregateType(type: string): IEvent<T>;
  withMetadata(metadata: EventMetadata): IEvent<T>;
}

export enum EventAction {
  PRE_APPEND = 'PRE_APPEND',
  APPEND_ERRORED = 'APPEND_ERRORED',
  APPENDED = 'APPENDED',
  LOADED = 'LOADED',
}

export type EventCallback = (event: IEvent, action: EventAction, eventStore: IEventStore) => IEvent | Promise<IEvent>;

export interface EventMiddleWare {
  action: EventAction;
  handler: EventCallback;
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
  REGEX = 'regex',
}

export enum FieldType {
  METADATA = 'metadata',
  MESSAGE_PROPERTY = 'message_property',
}

export interface MetadataMatch<T extends MetadataOperator> {
  field: string;
  value: T extends MetadataOperator.IN
    ? Array<string | number | Date>
    : T extends MetadataOperator.NOT_IN
    ? Array<string | number | Date>
    : string | number | Date | boolean;
  operation: T;
  fieldType: FieldType;
}

export interface IMetadataMatcher {
  data: MetadataMatch<MetadataOperator>[];
}
