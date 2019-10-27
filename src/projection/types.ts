import { IEvent, IMetadataMatcher } from "../types";

export enum ProjectionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  STOPPING = 'stopping',
  DELETING = 'deleting',
  DELETING_INCL_EMITTED_EVENTS = 'deleting incl emitted events',
  RESETTING = 'resetting',
}

export interface IState {}

export interface IStream {
  streamName: string;
  matcher?: IMetadataMatcher;
}

export interface IProjectionManager {
  createProjector<T>(name: string): IProjector<T>;

  createReadModelProjector<R extends IReadModel, T extends IState = IState>(name: string, readModel: R): IReadModelProjector<R, T>;

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

export interface IProjector<T extends IState = IState> {
  init(callback: Function): IProjector<T>;

  fromStream(stream: IStream): IProjector<T>;

  fromStreams(...streams: IStream[]): IProjector<T>;

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

export interface IReadModelProjector<R extends IReadModel, T extends IState = IState> {
  readModel: R;

  init(callback: Function): IReadModelProjector<R, T>;

  fromStream(stream: IStream): IReadModelProjector<R, T>;

  fromStreams(...streams: IStream[]): IReadModelProjector<R, T>;

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

  fromStream(stream: IStream): IQuery;

  fromStreams(...streams: IStream[]): IQuery;

  fromAll(): IQuery;

  when(handlers: { [event: string]: <T extends IState>(state: T, event: IEvent) => T }): IQuery;

  whenAny(handler: <T extends IState>(state: T, event: IEvent) => T): IQuery;

  reset(): Promise<void>;

  stop(): Promise<void>;

  getState(): IState;

  run(): Promise<void>;
}

export interface IProjectionConstructor<T extends IState = IState> {
  new(projectorManager: IProjectionManager): IProjection<T>
  projectionName: string;
}

export interface IProjection<T extends IState> {
  run(keepRunning: boolean): Promise<any>;
  reset(): Promise<void>;
  getState(): T;
  delete(deleteEmittedEvents: boolean): Promise<void>;
}

export interface IReadModelProjectionConstructor<R extends IReadModel, T extends IState> {
  new(projectorManager: IProjectionManager, readModel: IReadModel): IReadModelProjection<R, T>
  projectionName: string;
}

export interface IReadModelProjection<R extends IReadModel, T extends IState> {
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
