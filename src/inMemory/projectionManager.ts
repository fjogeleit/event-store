import {
  IProjectionManager,
  ProjectionStatus,
  IProjector,
  IQuery,
  State,
  IReadModel,
  IReadModelProjector
} from "../projection/types";
import { Query } from "../projection/query";
import { InMemoryReadModelProjector } from "./readModelProjector";
import { InMemoryProjector } from "./projector";
import { InMemoryEventStore } from "./eventStore";

export class InMemoryProjectionManager implements IProjectionManager {
  private projections: { [projection: string]: { state: State, positions: object, status: ProjectionStatus } } = {};

  constructor(private readonly eventStore: InMemoryEventStore) {}

  createProjector<T extends State = State>(name: string): IProjector<T> {
    return new InMemoryProjector(name, this, this.eventStore, this.projections)
  }

  createReadModelProjector<R extends IReadModel, T extends State = State>(name: string, readModel: R): IReadModelProjector<R, T> {
    return new InMemoryReadModelProjector<R, T>(name, this, this.eventStore, this.projections, readModel)
  }

  createQuery(): IQuery {
    return new Query(this, this.eventStore)
  }

  async fetchProjectionState(name: string): Promise<object> {
    return this._selectProjectionProperty<object>(name, 'state');
  }

  async fetchProjectionStatus(name: string): Promise<ProjectionStatus> {
    return await this._selectProjectionProperty<ProjectionStatus>(name, 'status');
  }

  async fetchProjectionStreamPositions(name: string): Promise<{ [streamName: string]: number}> {
    return this._selectProjectionProperty<{ [streamName: string]: number}>(name, 'position');
  }

  async fetchAllProjectionNames(): Promise<string[]> {
    return  Object.keys(this.projections);
  }

  async deleteProjection(name: string, deleteEmittedEvents: boolean = false): Promise<void> {
    return this._updateProjectionStatus(name, deleteEmittedEvents ? ProjectionStatus.DELETING_INCL_EMITTED_EVENTS : ProjectionStatus.DELETING)
  }

  async resetProjection(name: string): Promise<void> {
    return this._updateProjectionStatus(name, ProjectionStatus.RESETTING)
  }

  async stopProjection(name: string): Promise<void> {
    return this._updateProjectionStatus(name, ProjectionStatus.STOPPING)
  }

  async idleProjection(name: string): Promise<void> {
    return this._updateProjectionStatus(name, ProjectionStatus.IDLE)
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
