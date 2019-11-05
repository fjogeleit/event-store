import { Pool } from 'mysql';
import { MysqlConfiguration, PROJECTIONS_TABLE } from '../index';
import { MysqlProjector } from './projector';
import { createMysqlPool, promisifyQuery } from '../helper';
import { MysqlReadModelProjector } from './read-model-projector';
import { ProjectionNotFound } from '../exception';
import { IEventStore } from '../types';
import { Query, IProjectionManager, ProjectionStatus, IProjector, IQuery, IState, IReadModel, IReadModelProjector } from '../projection';

export class MysqlProjectionManager implements IProjectionManager {
  private readonly client: Pool;

  constructor(readonly connection: MysqlConfiguration, private readonly eventStore: IEventStore) {
    this.client = createMysqlPool(connection);
  }

  createProjector<T extends IState = IState>(name: string): IProjector<T> {
    return new MysqlProjector(name, this, this.eventStore, this.client);
  }

  createReadModelProjector<R extends IReadModel, T extends IState = IState>(name: string, readModel: R): IReadModelProjector<R, T> {
    return new MysqlReadModelProjector<R, T>(name, this, this.eventStore, this.client, readModel);
  }

  createQuery(): IQuery {
    return new Query(this, this.eventStore);
  }

  async fetchProjectionState(name: string): Promise<object> {
    return JSON.parse(await this._selectProjectionProperty<string>(name, 'state'));
  }

  async fetchProjectionStatus(name: string): Promise<ProjectionStatus> {
    return this._selectProjectionProperty<ProjectionStatus>(name, 'status');
  }

  async fetchProjectionStreamPositions(name: string): Promise<{ [streamName: string]: number }> {
    return JSON.parse(await this._selectProjectionProperty<string>(name, 'position'));
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
    const result = await promisifyQuery<number>(
      this.client,`UPDATE ${PROJECTIONS_TABLE} SET status = ? WHERE "name" = ?`,
      [status, name],
      (result) => result.affectedRows
    );

    if (result === 0) {
      throw ProjectionNotFound.withName(name);
    }
  }

  private async _selectProjectionProperty<T>(name: string, property: string): Promise<T> {
    const result = await promisifyQuery<any[]>(
      this.client,`SELECT "${property}" FROM ${PROJECTIONS_TABLE} SET status = ? WHERE "name" = ? LIMIT 1`,
      [name],
      (result) => result.length
    );

    if (result.length === 0) {
      throw ProjectionNotFound.withName(name);
    }

    return result[0][property];
  }
}
