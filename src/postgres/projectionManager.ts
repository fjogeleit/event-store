import { Pool } from "pg";
import { EventStore, PROJECTIONS_TABLE } from "../index";
import { ProjectionManager, ProjectionStatus, Projector, Query } from "../projection/types";
import { PostgresProjector } from "./projector";
import { PostgresQuery } from "./query";

export class PostgresProjectionManager implements ProjectionManager {
  constructor(
    private readonly client: Pool,
    private readonly eventStore: EventStore
  ) {}

  createProjector(name: string): Projector {
    return new PostgresProjector(name, this, this.eventStore, this.client)
  }

  createQuery(): Query {
    return new PostgresQuery(this, this.eventStore, this.client)
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
