import { Pool } from "pg";
import { PostgresEventStore } from "./eventStore";
import { PostgresWriteLockStrategy } from "./postgres/writeLockStrategy";
import { AggregateRepository } from "./aggregate/aggregateRepository";

export interface EventStore {
  install: () => void;
  load: (streamName: string, fromNumber: number, metadataMatcher?: MetadataMatcher) => Promise<IEvent[]>;
  appendTo: (streamName: string, events: IEvent[]) => Promise<void>;
  createRepository: <T extends Aggregate>(
    streamName: string,
    aggregate: AggregateConstructor<T>,
    aggregateEvents: IEventConstructor[]
  ) => Repository<T>
}

export interface WriteLockStrategy {
  createLock: (name: string) => Promise<void>
  releaseLock: (name: string) => Promise<void>
}

export interface Aggregate {
  popEvents: () => IEvent[]
  fromHistory: (events: IEvent[]) => Aggregate
}

export interface RepositoryConfiguration<T> {
  eventStore: EventStore;
  aggregate: AggregateConstructor<T>;
  events: IEventConstructor[];
  streamName: string;
}

export interface Repository<T extends Aggregate> {
  save: (aggregate: T) => Promise<void>
  get: (aggregateId: string) => Promise<T>
}

export interface ELConfig {
  client: Pool,
  writeLock: WriteLockStrategy,
  eventStreamTable: string,
  middleware?: EventMiddleWare[]
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
  METADATA,
  MESSAGE_PROPERTY
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

export const createWriteLock = (client: Pool) => new PostgresWriteLockStrategy(client);

export const createEventStore = (config: ELConfig) => new PostgresEventStore(config);
export const createRepository = <T extends Aggregate>(config: RepositoryConfiguration<T>) => new AggregateRepository<T>(config);

export * from './event'
