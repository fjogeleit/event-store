import { Client, Identifiers, Values } from './types';
import { Database } from 'sqlite3';

let client: Database = null;

export const createSqlitelPool = (connectionString: string): Database => {
  if (!client) {
    client = new Database(connectionString);
  }

  return client;
};

export const promisifyQuery = <T>(client: Database, query: string, values?: any[] | object, resultFn?: (result: any) => T): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    client.serialize(() => {
      client.all(query, values, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
  
        if (resultFn) {
          resolve(resultFn(result));
        }
  
      // @ts-ignore
        resolve(result)
      })
    })
  });
};

export const promisifyRun = <T = void>(client: Database, query: string, values?: any[] | object, resultFn?: (result: any) => T): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    client.serialize(() => {
      client.run(query, values, function (error) {
        if (error) {
          return reject(error);
        }

        if (!resultFn) {
          return resolve();
        }
  
        resolve(resultFn(this));
      })
    })
  });
};

export class SqliteClient<T extends Database = Database> implements Client<T> {
  constructor(private readonly client: T) {}

  get connection(): T {
    return this.client;
  }

  async exists(collection: string): Promise<boolean> {
    const result = await promisifyQuery<number>(
      this.client,
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ?`,
      [collection],
      (result: Array<any>) => result.length
    );

    return result === 1;
  }

  async reset(collection: string) {
    throw Error('Unsupported for SQLite driver')
  }

  async delete(collection: string) {
    await promisifyRun(this.client, `DROP TABLE IF EXISTS ${collection};`, []);
  }

  insert(collection: string, values: Values) {
    return promisifyRun(this.client, `INSERT INTO ${collection} SET ?`, values);
  }

  remove(collection: string, identifiers: Identifiers) {
    const condition = Object.keys(identifiers).map((column) => {
      return `${column} = ?`;
    });

    return promisifyRun(
      this.client,
      `DELETE FROM ${collection} WHERE ${condition}`,
      Object.values(identifiers)
      );
  }

  async update(collection: string, values: any[], identifiers: any[]) {
    const setter = Object.keys(values).map((column) => {
      return `${column} = ?`;
    });

    const condition = Object.keys(identifiers).map((column) => {
      return `${column} = ?`;
    });

    return promisifyRun(
      this.client,
      `UPDATE ${collection} SET ${setter} WHERE ${condition}`,
      [...Object.values(values), ...Object.values(identifiers)]
      );
  }
}
