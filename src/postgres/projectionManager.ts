import { Pool } from "pg";
import { EventStore } from "../index";
import { ProjectionManager, ProjectionStatus } from "../projection/types";

export class PostgresProjectionManager implements ProjectionManager{
  constructor(
    private readonly eventStreamsTable: string,
    private readonly client: Pool,
    private readonly eventStore: EventStore
  ) {}

  async fetchProjectionState(name: string): Promise<object> {
    return this._updateProjectionProperty<object>(name, 'state');
  }

  async fetchProjectionStatus(name: string): Promise<ProjectionStatus> {
    return await this._updateProjectionProperty<ProjectionStatus>(name, 'status');
  }

  async fetchProjectionStreamPositions(name: string): Promise<{ [streamName: string]: number}> {
    return this._updateProjectionProperty<{ [streamName: string]: number}>(name, 'position');
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

  private async _updateProjectionStatus(name: string, status: ProjectionStatus): Promise<void> {
    try {
      const result = await this.client.query(`UPDATE projections SET status = $1 WHERE "name" = $2`, [
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

  private async _updateProjectionProperty<T>(name: string, property: string): Promise<T> {
    try {
      const result = await this.client.query<T>(`SELECT "${property}" FROM projections WHERE "name" = $1 LIMIT 1`, [name]);

      if (result.rowCount === 0) {
        throw new Error(`Projection ${ name } not found`)
      }

      return result.rows[0][property];
    } catch (error) {
      throw new Error(`State fetch failed with ${error.toString()}`)
    }
  }
}
