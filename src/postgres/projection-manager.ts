import { Pool } from 'pg';
import { PROJECTIONS_TABLE } from '../index';
import { PostgresProjector } from './projector';
import { createPostgresClient } from '../helper/postgres';
import { PostgresReadModelProjector } from './read-model-projector';
import { ProjectionNotFound } from '../exception';
import { IEventStore } from '../types';
import { Query, IProjectionManager, ProjectionStatus, IProjector, IQuery, IState, IReadModel, IReadModelProjector } from '../projection';

export class PostgresProjectionManager implements IProjectionManager {
  private readonly client: Pool;

  constructor(readonly connectionString: string, private readonly eventStore: IEventStore) {
    this.client = createPostgresClient(this.connectionString);
  }

  createProjector<T extends IState = IState>(name: string): IProjector<T> {
    return new PostgresProjector(name, this, this.eventStore, this.client);
  }

  createReadModelProjector<R extends IReadModel, T extends IState = IState>(name: string, readModel: R): IReadModelProjector<R, T> {
    return new PostgresReadModelProjector<R, T>(name, this, this.eventStore, this.client, readModel);
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
    return this.eventStore.registeredProjections;
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
    const result = await this.client.query(`UPDATE ${PROJECTIONS_TABLE} SET status = $1 WHERE "name" = $2`, [status, name]);

    if (result.rowCount === 0) {
      throw ProjectionNotFound.withName(name);
    }
  }

  private async _selectProjectionProperty<T>(name: string, property: string): Promise<T> {
    const result = await this.client.query<T>(`SELECT "${property}" FROM ${PROJECTIONS_TABLE} WHERE "name" = $1 LIMIT 1`, [name]);

    if (result.rowCount === 0) {
      throw ProjectionNotFound.withName(name);
    }

    return result.rows[0][property];
  }
}
