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

export interface ProjectionManager {
  createProjector(name: string): Projector;

  createQuery(): Query;

  deleteProjection(name: string, deleteEmittedEvents?: boolean): Promise<void>;

  resetProjection(name: string): Promise<void>;

  stopProjection(name: string): Promise<void>;

  idleProjection(name: string): Promise<void>;

  fetchProjectionStatus(name: string): Promise<ProjectionStatus>;

  fetchProjectionStreamPositions(name: string): Promise<{ [streamName: string]: number}>;

  fetchProjectionState(name: string): Promise<object>;
}

export interface Projector {
  init(callback: Function): Projector;

  fromStream(stream: Stream): Projector;

  fromStreams(...streams: Stream[]): Projector;

  fromAll(): Projector;

  when(handlers: { [event: string]: <T extends State>(state: T, event: IEvent) => T }): Projector;

  whenAny(handler: <T extends State>(state: T, event: IEvent) => T): Projector;

  reset(): Promise<void>;

  stop(): Promise<void>;

  getState(): State;

  getName(): string;

  emit(event: IEvent): Promise<void>;

  linkTo(streamName: string, event: IEvent): Promise<void>;

  delete(deleteEmittedEvents: boolean): Promise<void>;

  run(keepRunning: boolean): Promise<void>;
}

export interface Query {
  init(callback: Function): Query;

  fromStream(stream: Stream): Query;

  fromStreams(...streams: Stream[]): Query;

  fromAll(): Query;

  when(handlers: { [event: string]: <T extends State>(state: T, event: IEvent) => T }): Query;

  whenAny(handler: <T extends State>(state: T, event: IEvent) => T): Query;

  reset(): Promise<void>;

  stop(): Promise<void>;

  getState(): State;

  run(): Promise<void>;
}

export interface ProjectionConstructor<T extends Projection<any>> {
  new(projectorManager: ProjectionManager): T
  projectionName: string;
}

export interface Projection<T extends State> {
  projectionName: string;

  run(keepRunning: boolean): Promise<T>;
  reset(): Promise<void>;
  delete(deleteEmittedEvents: boolean): Promise<void>;
}
