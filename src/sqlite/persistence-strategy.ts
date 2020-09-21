import {
  FieldType,
  IEvent,
  IEventConstructor,
  LoadStreamParameter,
  IMetadataMatcher,
  MetadataOperator
} from '../types';

import { Database } from 'sqlite3';
import { createSqlitelPool, promisifyQuery, promisifyRun } from '../helper/sqlite';
import { PersistenceStrategy } from '../event-store';
import { StreamAlreadyExists, StreamNotFound } from '../exception';
import { EVENT_STREAMS_TABLE, PROJECTIONS_TABLE } from '../index';
import { SqliteOptions } from "./types";
import { SqliteIterator } from "./iterator";

const sha1 = require('js-sha1');

const generateTable = (streamName: string): string => {
  return `_${sha1(streamName)}`;
};

export class SqlitePersistenceStrategy implements PersistenceStrategy {
  private readonly client: Database;
  private readonly eventMap: { [aggregateEvent: string]: IEventConstructor };

  constructor(private readonly options: SqliteOptions) {
    this.client = createSqlitelPool(options.connectionString);

    this.eventMap = this.options.registry.aggregates.reduce((eventMap, aggregate) => {
      const items = aggregate.registeredEvents().reduce<{ [aggregateEvent: string]: IEventConstructor }>((item, event) => {
        item[`${aggregate.name}:${event.name}`] = event;

        return item;
      }, {});

      return { ...eventMap, ...items };
    }, {});
  }

  public async close() {
    this.client.close();
  }

  public async createEventStreamsTable() {
    try {
      const result = await promisifyQuery<number>(
        this.client,
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ?`,
        [EVENT_STREAMS_TABLE],
        (result: Array<any>) => result.length
      );

      if (result === 1) {
        return;
      }

      await promisifyRun(
        this.client,
        `
          CREATE TABLE ${EVENT_STREAMS_TABLE} (
            no INTEGER PRIMARY KEY AUTOINCREMENT,
            real_stream_name VARCHAR(150) NOT NULL,
            stream_name VARCHAR(41) NOT NULL,
            metadata JSON,
            UNIQUE (real_stream_name)
          )`
      );
    } catch (e) {
      console.error('Failed to install EventStreams Table: %s', e.toString(), e.stack);
    }
  }

  public async createProjectionsTable() {
    try {
      const result = await promisifyQuery<number>(
        this.client,
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ?`,
        [PROJECTIONS_TABLE],
        (result) => result.length
      );

      if (result === 1) {
        return;
      }

      await promisifyQuery<void>(
        this.client,
        `
          CREATE TABLE ${PROJECTIONS_TABLE} (
            no INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(150) NOT NULL,
            position JSON,
            state JSON,
            status VARCHAR(28) NOT NULL,
            locked_until CHAR(26),
            UNIQUE (name)
          )`,
        [],
        () => {}
      );
    } catch (e) {
      console.error('Failed to install Projections Table: %s', e.toString());
    }
  }

  public async addStreamToStreamsTable(streamName: string) {
    const tableName = generateTable(streamName);

    try {
      await promisifyRun(
        this.client,
        `INSERT INTO ${EVENT_STREAMS_TABLE} (real_stream_name, stream_name, metadata) VALUES (?, ?, ?)`,
        [streamName, tableName, '[]']
      );
    } catch (error) {
      if (error.code === '23000') {
        throw StreamAlreadyExists.withName(streamName);
      }

      throw new Error(`Error ${error.code}: EventStream Table exists? ErrorDetails: ${error.toString()}`);
    }
  }

  public async removeStreamFromStreamsTable(streamName: string) {
    await promisifyRun(
      this.client,
      `DELETE FROM ${EVENT_STREAMS_TABLE} WHERE real_stream_name = ?`,
      [streamName],
    );
  }

  public async hasStream(streamName: string) {
    const result = await promisifyQuery<number>(
      this.client,
      `SELECT "no" FROM ${EVENT_STREAMS_TABLE} WHERE real_stream_name = ?`,
      [streamName],
      (result: Array<any>) => result.length
    );

    return result === 1;
  }

  public async deleteStream(streamName: string) {
    await this.removeStreamFromStreamsTable(streamName);
    await this.dropSchema(streamName);
  }

  public async createSchema(streamName: string) {
    const tableName = generateTable(streamName);

    await promisifyRun(
      this.client,
      `CREATE TABLE ${tableName} (
        no INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id CHAR(36) NOT NULL,
        event_name VARCHAR(100) NOT NULL,
        payload JSON NOT NULL,
        metadata JSON NOT NULL,
        created_at DATETIME(6) NOT NULL,
        aggregate_version INTEGER GENERATED ALWAYS AS (JSON_EXTRACT(metadata, '$._aggregate_version')) STORED NOT NULL,
        aggregate_id CHAR(36) GENERATED ALWAYS AS (JSON_EXTRACT(metadata, '$._aggregate_id')) STORED NOT NULL,
        aggregate_type VARCHAR(150) GENERATED ALWAYS AS (JSON_EXTRACT(metadata, '$._aggregate_type')) STORED NOT NULL,
        UNIQUE (event_id),
        UNIQUE (aggregate_type, aggregate_id, aggregate_version)
    )`);
  }

  public async dropSchema(streamName: string) {
    return promisifyRun(this.client, `DROP TABLE IF EXISTS ${generateTable(streamName)};`);
  }

  public async appendTo<T extends object = object>(streamName: string, events: IEvent<T>[]) {
    const tableName = generateTable(streamName);

    const data = events.map(event => ({
      event_id: event.uuid,
      event_name: event.name,
      payload: JSON.stringify(event.payload),
      metadata: JSON.stringify(event.metadata),
      created_at: event.createdAt.toISOString(),
    }));
    
    return new Promise<void>((resolve, reject) => {
      this.client.serialize(() => {
        const stmt = this.client.prepare(`INSERT INTO ${tableName} (event_id, event_name, payload, metadata, created_at) VALUES (?, ?, ?, ?, ?);`);

        data.forEach(event => stmt.run([event.event_id, event.event_name, event.payload, event.metadata, event.created_at]));

        stmt.finalize((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve()
        })
      });
    });
  }

  public async load(streamName: string, fromNumber: number, count?: number, matcher?: IMetadataMatcher): Promise<AsyncIterable<IEvent>> {
    const { query, values } = await this.createQuery(streamName, fromNumber, matcher);

    return new SqliteIterator(this.client, { query, values }, this.eventMap);
  }

  public async mergeAndLoad(streams: Array<LoadStreamParameter>) {
    let queries = [];
    let parameters = [];

    for (const { streamName, fromNumber = 1, matcher } of streams) {
      const { query, values } = await this.createQuery(streamName, fromNumber, matcher);

      queries.push(query);
      parameters.push(values);
    }

    let query = queries[0];

    if (queries.length > 1) {
      query = queries.map(query => query).join(' UNION ALL ') + ' ORDER BY created_at ASC';
    }

    const values = parameters.reduce<Array<any>>((params, values) => [...params, ...values], []);

    const iterator = new SqliteIterator(this.client, { query, values }, this.eventMap);

    return iterator;
  }

  private async createQuery(streamName: string, fromNumber: number, matcher?: IMetadataMatcher) {
    const result = await this.hasStream(streamName);

    if (result === false) {
      throw StreamNotFound.withName(streamName);
    }

    const tableName = generateTable(streamName);

    const { where, values } = this.createWhereClause(matcher);

    where.push(`no >= ?`);
    values.push(fromNumber);

    const whereCondition = `WHERE ${where.join(' AND ')}`;

    return {
      query: `SELECT *, '${streamName}' as stream FROM ${tableName} ${whereCondition}`,
      values,
    };
  }

  private createWhereClause(matcher?: IMetadataMatcher): { where: string[]; values: any[] } {
    const where = [];
    const values = [];

    if (!matcher) return { where, values };

    matcher.data.forEach(match => {
      let expression = (_: string) => '';

      switch (match.operation) {
        case MetadataOperator.IN:
          expression = (value: string) => `IN ${value}`;
          break;
        case MetadataOperator.NOT_IN:
          expression = (value: string) => `NOT IN ${value}`;
          break;
        case MetadataOperator.REGEX:
          expression = (value: string) => `REGEXP ${value}`;
          break;
        default:
          expression = (value: string) => `${match.operation} ${value}`;
          break;
      }

      if (match.fieldType === FieldType.METADATA) {
        if (typeof match.value === 'boolean') {
          where.push(`metadata->"$.${match.field}" ${expression(match.value.toString())}`);

          return;
        }

        values.push(match.value);
        where.push(`JSON_EXTRACT(metadata, '$.${match.field}') ${expression(`?`)}`);
      }

      if (match.fieldType === FieldType.MESSAGE_PROPERTY) {
        if (typeof match.value === 'boolean') {
          where.push(`${match.field} ${expression(match.value.toString())}`);

          return;
        }

        values.push(match.value);
        where.push(`${match.field} ${expression(`?`)}`);
      }
    });

    return { where, values };
  }
}
