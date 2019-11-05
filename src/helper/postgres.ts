import { Client, Identifiers, Values } from './types';
import { Pool } from 'pg';
const format = require('pg-format');

let client: Pool = null;

export const createPostgresClient = (connectionString: string): Pool => {
  if (!client) {
    client = new Pool({ connectionString });
  }

  return client;
};

export class PostgresClient<T extends Pool = Pool> implements Client<T> {
  constructor(private readonly client: T) {}

  get connection(): T {
    return this.client;
  }

  async exists(collection: string): Promise<boolean> {
    const result = await this.client.query(`SELECT * FROM pg_catalog.pg_tables WHERE tablename = '${collection}';`);

    return result.rowCount === 1;
  }

  async delete(collection: string): Promise<void> {
    await this.client.query(`DROP TABLE IF EXISTS '${collection}';`);
  }

  async reset(collection: string): Promise<void> {
    await this.client.query(`TRUNCATE TABLE '${collection}';`);
  }

  async insert(collection: string, values: Values) {
    const columns = Object.keys(values);

    await this.client.query(format(`INSERT INTO %I (%s) VALUES (%L)`, collection, columns.join(','), Object.values(values)));
  }

  async remove(collection: string, identifiers: Identifiers) {
    const condition = Object.keys(identifiers).map((column, index) => {
      return `"${column}" = $${++index}`;
    });

    await this.client.query(format(`DELETE FROM %I WHERE %s `, collection, condition), Object.values(identifiers));
  }

  async update(collection: string, values: any[], identifiers: any[]) {
    const setter = Object.keys(values).map((column, index) => {
      return `"${column}" = $${++index}`;
    });

    const condition = Object.keys(identifiers).map((column, index) => {
      return `"${column}" = $${++index + setter.length}`;
    });

    await this.client.query(format(`UPDATE %I SET %s WHERE %s`, collection, setter, condition), [
      ...Object.values(values),
      ...Object.values(identifiers),
    ]);
  }
}
