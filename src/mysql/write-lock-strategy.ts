import { Pool } from 'mysql';
import { WriteLockStrategy } from '../types';

export class MysqlWriteLockStrategy implements WriteLockStrategy {
  constructor(private readonly client: Pool) {}

  public async createLock(name: string) {
    try {
      const result = await new Promise<Array<{ get_lock: string }>>((resolve, reject) => {
        this.client.query(`SELECT GET_LOCK('${ name }', '-1') as 'get_lock';`, (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        })
      });

      return result[0].get_lock == '1'
    } catch {
      return false;
    }
  }

  public async releaseLock(name: string) {
    try {
      await new Promise<Array<{ get_lock: string }>>((resolve, reject) => {
        this.client.query(`DO RELEASE_LOCK('${name}') as 'release_lock';`, (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        })
      });

      return true
    } catch {
      return false;
    }
  }
}
