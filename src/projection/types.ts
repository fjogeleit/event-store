export enum ProjectionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  STOPPING = 'stopping',
  DELETING = 'deleting',
  DELETING_INCL_EMITTED_EVENTS = 'deleting incl emitted events',
  RESETTING = 'resetting',
}

export interface ProjectionManager {
  deleteProjection(name: string, deleteEmittedEvents?: boolean): Promise<void>;

  resetProjection(name: string): void;

  stopProjection(name: string): void;

  fetchProjectionStatus(name: string): Promise<ProjectionStatus>;

  fetchProjectionStreamPositions(name: string): Promise<{ [streamName: string]: number}>;

  fetchProjectionState(name: string): Promise<object>;
}
