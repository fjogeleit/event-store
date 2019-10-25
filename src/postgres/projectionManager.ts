import { Pool } from "pg";
import { EVENT_STREAMS_TABLE, IEventStore, PROJECTIONS_TABLE } from "../index";
import {
  IProjectionManager,
  ProjectionStatus,
  IProjector,
  IQuery,
  State,
  IReadModel,
  IReadModelProjector
} from "../projection/types";
import { PostgresProjector } from "./projector";
import { Query } from "../projection/query";
import { createPostgresClient } from "../helper/postgres";
import { PostgresReadModelProjector } from "./readModelProjector";

export class PostgresProjectionManager implements IProjectionManager {
  private readonly client: Pool;

  constructor(readonly connectionString: string, private readonly eventStore: IEventStore) {
    this.client = createPostgresClient(this.connectionString);
  }

  createProjector<T extends State = State>(name: string): IProjector<T> {
    return new PostgresProjector(name, this, this.eventStore, this.client)
  }

  createReadModelProjector<R extends IReadModel, T extends State = State>(name: string, readModel: R): IReadModelProjector<R, T> {
    return new PostgresReadModelProjector<R, T>(name, this, this.eventStore, this.client, readModel)
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
    return  await this.client
      .query<{ real_stream_name: string }>(`SELECT real_stream_name FROM ${ EVENT_STREAMS_TABLE } WHERE real_stream_name NOT LIKE '$%'`)
      .then(result => result.rows.map(row => row.real_stream_name));
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
    try {
      const result = await this.client.query(`UPDATE ${PROJECTIONS_TABLE} SET status = $1 WHERE "name" = $2`, [
        status,
        name
      ]);

      if (result.rowCount === 0) {
        throw new Error(`Projection ${name} not found`)
      }
    } catch (error) {
      throw new Error(`ProjectionTable update failed ${error.toString()}`)
    }
  }

  private async _selectProjectionProperty<T>(name: string, property: string): Promise<T> {
    try {
      const result = await this.client.query<T>(`SELECT "${property}" FROM ${PROJECTIONS_TABLE} WHERE "name" = $1 LIMIT 1`, [name]);

      if (result.rowCount === 0) {
        throw new Error(`Projection ${ name } not found`)
      }

      return result.rows[0][property];
    } catch (error) {
      throw new Error(`State fetch failed with ${error.toString()} for ${property}`)
    }
  }
}
