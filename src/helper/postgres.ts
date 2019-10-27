import { Client, Identifiers, Values } from "./types";
import { Pool } from "pg";
const format = require('pg-format');

let client: Pool = null;

export const createPostgresClient = (connectionString: string): Pool => {
  if (!client) {
    client = new Pool({ connectionString });
  }

  return client;
};

export class SQLClient<T extends Pool = Pool> implements Client<T> {
  constructor(private readonly dbClient: T) {}

  get connection(): T {
    return this.dbClient;
  }

  async insert(collection: string, values: Values) {
    const columns = Object.keys(values);

    await this.dbClient.query(format(`INSERT INTO %I (%s) VALUES (%L)`, collection, columns.join(','), Object.values(values)));
  }

  async delete(collection: string, identifiers: Identifiers) {
    const condition = Object.keys(identifiers).map((column, index) => {
      return `"${column}" = $${++index}`;
    });

    await this.dbClient.query(format(`DELETE FROM %I WHERE %s `, collection, condition), Object.values(identifiers));
  }

  async update(collection: string, values: any[], identifiers: any[]) {
    const setter = Object.keys(values).map((column, index) => {
      return `"${column}" = $${++index}`;
    });

    const condition = Object.keys(identifiers).map((column, index) => {
      return `"${column}" = $${++index + setter.length}`;
    });

    await this.dbClient.query(format(`UPDATE %I SET %s WHERE %s`, collection, setter, condition), [
      ...Object.values(values),
      ...Object.values(identifiers)
    ]);
  }
}
