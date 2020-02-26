import {
  ProjectionStatus,
  IProjectionManager,
  IProjector,
  IQuery,
  IReadModel,
  IReadModelProjector,
  IState,
  IReadModelConstructor
} from '../projection';

import { Query } from '../projection';
import { InMemoryReadModelProjector } from './read-model-projector';
import { InMemoryProjector } from './projector';
import { InMemoryEventStore } from './event-store';

export class InMemoryProjectionManager implements IProjectionManager {
  private readonly projections: {
    [projection: string]: {
      state: IState;
      positions: object;
      status: ProjectionStatus;
    };
  } = {};

  constructor(private readonly eventStore: InMemoryEventStore) {}

  createProjector<T extends IState = IState>(name: string): IProjector<T> {
    this.projections[name] = {
      state: undefined,
      status: ProjectionStatus.IDLE,
      positions: {},
    };

    return new InMemoryProjector(name, this, this.eventStore, this.projections);
  }

  createReadModelProjector<R extends IReadModel, T extends IState = IState>(name: string, ReadModelConstructor: IReadModelConstructor<R>): IReadModelProjector<R, T> {
    this.projections[name] = {
      state: undefined,
      status: ProjectionStatus.IDLE,
      positions: {},
    };

    return new InMemoryReadModelProjector<R, T>(name, this, this.eventStore, this.projections, ReadModelConstructor);
  }

  createQuery(): IQuery {
    return new Query(this, this.eventStore);
  }

  async fetchProjectionState(name: string): Promise<object> {
    return this._selectProjectionProperty<object>(name, 'state');
  }

  async fetchProjectionStatus(name: string): Promise<ProjectionStatus> {
    return await this._selectProjectionProperty<ProjectionStatus>(name, 'status');
  }

  async fetchProjectionStreamPositions(name: string): Promise<{ [streamName: string]: number }> {
    return this._selectProjectionProperty<{ [streamName: string]: number }>(name, 'position');
  }

  fetchAllProjectionNames(): string[] {
    return Object.keys(this.projections);
  }

  async deleteProjection(name: string, deleteEmittedEvents: boolean = false): Promise<void> {
    return this._updateProjectionStatus(name, deleteEmittedEvents ? ProjectionStatus.DELETING_INCL_EMITTED_EVENTS : ProjectionStatus.DELETING);
  }

  async resetProjection(name: string): Promise<void> {
    return this._updateProjectionStatus(name, ProjectionStatus.RESETTING);
  }

  async stopProjection(name: string): Promise<void> {
    return this._updateProjectionStatus(name, ProjectionStatus.STOPPING);
  }

  async idleProjection(name: string): Promise<void> {
    return this._updateProjectionStatus(name, ProjectionStatus.IDLE);
  }

  private async _updateProjectionStatus(name: string, status: ProjectionStatus): Promise<void> {
    if (!(name in this.projections)) return;

    this.projections[name].status = status;
  }

  private async _selectProjectionProperty<T>(name: string, property: string): Promise<T> {
    if (!(name in this.projections)) return;

    return this.projections[name][property] as T;
  }
}
