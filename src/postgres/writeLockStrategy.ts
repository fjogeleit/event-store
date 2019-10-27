import { Pool } from "pg";
import { WriteLockStrategy } from "../types";

export class PostgresWriteLockStrategy implements WriteLockStrategy {
  constructor(private readonly client: Pool) {}

  public async createLock(name: string) {
    await this.client.query(`select pg_advisory_lock(hashtext('${name}'));`)
  }

  public async releaseLock(name: string) {
    await this.client.query(`select pg_advisory_unlock(hashtext('${name}'));`)
  }
}
