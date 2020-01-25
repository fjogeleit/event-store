import { Client, Identifiers, Values, MysqlParameter } from './types';
import { Pool, createPool } from 'mysql';
import { EVENT_STREAMS_TABLE } from "../index";

let client: Pool = null;

export const createMysqlPool = ({ host, user, password, database, port }: MysqlParameter): Pool => {
  if (!client) {
    client = createPool({ user, password, host, database, port, dateStrings: true });
  }

  return client;
};

export const promisifyQuery = <T>(client: Pool, query, values, resultFn?: (result: any) => T): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    client.query(query, values, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      if (resultFn) {
        resolve(resultFn(result));
      }

      resolve(result)
    })
  });
};

export class MySQLClient<T extends Pool = Pool> implements Client<T> {
  constructor(private readonly client: T) {}

  get connection(): T {
    return this.client;
  }

  async exists(collection: string): Promise<boolean> {
    const result = await promisifyQuery<number>(
      this.client,
      'SHOW TABLES LIKE ?',
      [collection],
      (result: Array<any>) => result.length
    );

    return result === 1;
  }

  async reset(collection: string) {
    await promisifyQuery<void>(this.client, `TRUNCATE TABLE ${collection};`, [], () => {});
  }

  async delete(collection: string) {
    await promisifyQuery<void>(this.client, `DROP TABLE IF EXISTS ${collection};`, [], () => {});
  }

  insert(collection: string, values: Values) {
    return promisifyQuery<void>(this.client, `INSERT INTO ${collection} SET ?`, values, () => {});
  }

  remove(collection: string, identifiers: Identifiers) {
    const condition = Object.keys(identifiers).map((column) => {
      return `${column} = ?`;
    });

    return promisifyQuery<void>(
      this.client,
      `DELETE FROM ${collection} WHERE ${condition}`,
      Object.values(identifiers),
      () => {}
      );
  }

  async update(collection: string, values: any[], identifiers: any[]) {
    const setter = Object.keys(values).map((column) => {
      return `${column} = ?`;
    });

    const condition = Object.keys(identifiers).map((column) => {
      return `${column} = ?`;
    });

    return promisifyQuery<void>(
      this.client,
      `UPDATE ${collection} SET ${setter} WHERE ${condition}`,
      [...Object.values(values), ...Object.values(identifiers)],
      () => {}
      );
  }
}
