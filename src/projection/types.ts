import { IEvent, MetadataMatcher } from "../index";

export enum ProjectionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  STOPPING = 'stopping',
  DELETING = 'deleting',
  DELETING_INCL_EMITTED_EVENTS = 'deleting incl emitted events',
  RESETTING = 'resetting',
}

export interface State {
  [key: string]: any
}

export interface Stream {
  streamName: string;
  matcher?: MetadataMatcher;
}

export interface IProjectionManager {
  createProjector<T>(name: string): IProjector<T>;

  createReadModelProjector<R extends IReadModel, T extends State = State>(name: string, readModel: R): IReadModelProjector<R, T>;

  createQuery(): IQuery;

  deleteProjection(name: string, deleteEmittedEvents?: boolean): Promise<void>;

  resetProjection(name: string): Promise<void>;

  stopProjection(name: string): Promise<void>;

  idleProjection(name: string): Promise<void>;

  fetchProjectionStatus(name: string): Promise<ProjectionStatus>;

  fetchProjectionStreamPositions(name: string): Promise<{ [streamName: string]: number}>;

  fetchAllProjectionNames(): Promise<string[]>

  fetchProjectionState(name: string): Promise<object>;
}

export interface IProjector<T extends State = State> {
  init(callback: Function): IProjector<T>;

  fromStream(stream: Stream): IProjector<T>;

  fromStreams(...streams: Stream[]): IProjector<T>;

  fromAll(): IProjector<T>;

  when(handlers: { [event: string]: (state: T, event: IEvent) => T }): IProjector<T>;

  whenAny(handler: (state: T, event: IEvent) => T): IProjector<T>;

  reset(): Promise<void>;

  stop(): Promise<void>;

  getState(): T;

  getName(): string;

  emit(event: IEvent): Promise<void>;

  linkTo(streamName: string, event: IEvent): Promise<void>;

  delete(deleteEmittedEvents: boolean): Promise<void>;

  run(keepRunning: boolean): Promise<void>;
}

export interface IReadModelProjector<R extends IReadModel, T extends State = State> {
  readModel: R;

  init(callback: Function): IReadModelProjector<R, T>;

  fromStream(stream: Stream): IReadModelProjector<R, T>;

  fromStreams(...streams: Stream[]): IReadModelProjector<R, T>;

  fromAll(): IReadModelProjector<R, T>;

  when(handlers: { [event: string]: (state: T, event: IEvent) => T }): IReadModelProjector<R, T>;

  whenAny(handler: (state: T, event: IEvent) => T): IReadModelProjector<R, T>;

  reset(): Promise<void>;

  stop(): Promise<void>;

  getState(): T;

  getName(): string;

  emit(event: IEvent): Promise<void>;

  linkTo(streamName: string, event: IEvent): Promise<void>;

  delete(deleteEmittedEvents: boolean): Promise<void>;

  run(keepRunning: boolean): Promise<void>;
}

export interface IQuery {
  init(callback: Function): IQuery;

  fromStream(stream: Stream): IQuery;

  fromStreams(...streams: Stream[]): IQuery;

  fromAll(): IQuery;

  when(handlers: { [event: string]: <T extends State>(state: T, event: IEvent) => T }): IQuery;

  whenAny(handler: <T extends State>(state: T, event: IEvent) => T): IQuery;

  reset(): Promise<void>;

  stop(): Promise<void>;

  getState(): State;

  run(): Promise<void>;
}

export interface IProjectionConstructor<T extends State> {
  new<T>(projectorManager: IProjectionManager): IProjection<T>
  projectionName: string;
}

export interface IProjection<T extends State> {
  projectionName: string;

  run(keepRunning: boolean): Promise<T>;
  reset(): Promise<void>;
  delete(deleteEmittedEvents: boolean): Promise<void>;
}

export interface IReadModelProjectionConstructor<R, T> {
  new<R extends IReadModel, T extends State = State>(projectorManager: IProjectionManager, readModel: IReadModel): IReadModelProjection<R, T>
  projectionName: string;
}

export interface IReadModelProjection<R extends IReadModel, T extends State> {
  projectionName: string;
  readModel: R;

  run(keepRunning: boolean): Promise<T>;
  reset(): Promise<void>;
  delete(deleteProjection: boolean): Promise<void>;
}

export interface IReadModel {
  init(): Promise<void>;
  isInitialized(): Promise<boolean>;
  reset(): Promise<void>;
  delete(): Promise<void>;

  stack(method: string, ...args: any[]): void;
  persist(): Promise<void>;
}
