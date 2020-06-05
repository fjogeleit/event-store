import {
  FieldType,
  IEvent,
  IEventConstructor,
  LoadStreamParameter,
  IMetadataMatcher,
  MetadataOperator,
  WriteLockStrategy
} from '../types';

import { Pool, types } from 'pg';
import * as format from 'pg-format';
import { createPostgresClient } from '../helper/postgres';
import { PostgresWriteLockStrategy } from './write-lock-strategy';
import { PersistenceStrategy, WrappedMiddleware } from '../event-store';
import { StreamAlreadyExists, StreamNotFound, ConcurrencyException } from '../exception';
import { EVENT_STREAMS_TABLE, PROJECTIONS_TABLE } from '../index';
import { PostgresOptions } from "./types";
import { PostgresIterator } from "./iterator";

const sha1 = require('js-sha1');

const generateTable = (streamName: string): string => {
  return `_${sha1(streamName)}`;
};

const getTypeParser = (type, format) => {
  if (type === types.builtins.TIMESTAMP) {
    return value => {
      const date = new Date(value);

      const timeZone = -1 * date.getTimezoneOffset() * 60 * 1000;

      return (date.getTime() + timeZone) * 1000 + Number.parseInt(value.substring(-6));
    };
  }

  return types.getTypeParser(type, format);
};

export class PostgresPersistenceStrategy implements PersistenceStrategy {
  private readonly client: Pool;
  private readonly eventMap: { [aggregateEvent: string]: IEventConstructor };
  private readonly writeLock: WriteLockStrategy;

  constructor(private readonly options: PostgresOptions) {
    this.client = createPostgresClient(options.connectionString);
    this.writeLock = new PostgresWriteLockStrategy(this.client);

    this.eventMap = this.options.registry.aggregates.reduce((eventMap, aggregate) => {
      const items = aggregate.registeredEvents().reduce<{ [aggregateEvent: string]: IEventConstructor }>((item, event) => {
        item[`${aggregate.name}:${event.name}`] = event;

        return item;
      }, {});

      return { ...eventMap, ...items };
    }, {});
  }

  public async createEventStreamsTable() {
    try {
      const result = await this.client.query('SELECT * FROM pg_catalog.pg_tables WHERE tablename = $1', [EVENT_STREAMS_TABLE]);

      if (result.rowCount === 1) {
        return;
      }

      await this.client.query(`
          CREATE TABLE ${EVENT_STREAMS_TABLE} (
            no BIGSERIAL,
            real_stream_name VARCHAR(150) NOT NULL,
            stream_name CHAR(41) NOT NULL,
            metadata JSONB,
            PRIMARY KEY (no),
            UNIQUE (stream_name)
          );
      `);
    } catch (e) {
      console.error('Failed to install EventStreams Table: %s', e.toString());
    }
  }

  public async createProjectionsTable() {
    try {
      const result = await this.client.query('SELECT * FROM pg_catalog.pg_tables WHERE tablename = $1', [PROJECTIONS_TABLE]);

      if (result.rowCount === 1) {
        return;
      }

      await this.client.query(`
          CREATE TABLE ${PROJECTIONS_TABLE} (
            no BIGSERIAL,
            name VARCHAR(150) NOT NULL,
            position JSONB,
            state JSONB,
            status VARCHAR(28) NOT NULL,
            locked_until TIMESTAMP(6),
            PRIMARY KEY (no),
            UNIQUE (name)
          );
      `);
    } catch (e) {
      console.error('Failed to install Projections Table: %s', e.toString());
    }
  }

  public async addStreamToStreamsTable(streamName: string) {
    const tableName = generateTable(streamName);

    try {
      await this.client.query(`INSERT INTO ${EVENT_STREAMS_TABLE} (real_stream_name, stream_name, metadata) VALUES ($1, $2, $3)`, [
        streamName,
        tableName,
        JSON.stringify([]),
      ]);
    } catch (error) {
      if (['23000', '23505'].includes(error.code)) {
        throw StreamAlreadyExists.withName(streamName);
      }

      throw new Error(`Error ${error.code}: EventStream Table exists? ErrorDetails: ${error.toString()}`);
    }
  }

  public async removeStreamFromStreamsTable(streamName: string) {
    await this.client.query(`DELETE FROM ${EVENT_STREAMS_TABLE} WHERE real_stream_name = $1`, [streamName]);
  }

  public async hasStream(streamName: string) {
    const result = await this.client.query(`SELECT "no" FROM ${EVENT_STREAMS_TABLE} WHERE real_stream_name = $1`, [streamName]);

    return result.rowCount === 1;
  }

  public async deleteStream(streamName: string) {
    await this.removeStreamFromStreamsTable(streamName);
    await this.dropSchema(streamName);
  }

  public async createSchema(streamName: string) {
    const tableName = generateTable(streamName);

    await this.client.query(`
      CREATE TABLE ${tableName} (
          no BIGSERIAL,
          event_id UUID NOT NULL,
          event_name VARCHAR(100) NOT NULL,
          payload JSON NOT NULL,
          metadata JSONB NOT NULL,
          created_at TIMESTAMP(6) NOT NULL,
          PRIMARY KEY (no),
          CONSTRAINT aggregate_version_not_null CHECK ((metadata->>'_aggregate_version') IS NOT NULL),
          CONSTRAINT aggregate_type_not_null CHECK ((metadata->>'_aggregate_type') IS NOT NULL),
          CONSTRAINT aggregate_id_not_null CHECK ((metadata->>'_aggregate_id') IS NOT NULL),
          UNIQUE (event_id)
      );
    `);

    await this.client.query(
      `CREATE UNIQUE INDEX ON ${tableName} ((metadata->>'_aggregate_type'), (metadata->>'_aggregate_id'), (metadata->>'_aggregate_version'));`
    );
    await this.client.query(`CREATE UNIQUE INDEX ON ${tableName} ((metadata->>'_aggregate_type'), (metadata->>'_aggregate_id'), no);`);
  }

  public async dropSchema(streamName: string) {
    const tableName = generateTable(streamName);

    await this.client.query(`DROP TABLE IF EXISTS ${tableName};`);
  }

  public async appendTo<T extends object = object>(streamName: string, events: IEvent<T>[]) {
    const tableName = generateTable(streamName);

    const data = events.map(event => [
      event.uuid,
      event.name,
      JSON.stringify(event.payload),
      JSON.stringify(event.metadata),
      event.createdAt.toString(),
    ]);

    const lock = `${tableName}_write_lock`;

    await this.writeLock.createLock(lock);

    const client = await this.client.connect();

    try {
      await client.query('BEGIN');
      await client.query(format(`INSERT INTO ${tableName} (event_id, event_name, payload, metadata, created_at) VALUES %L`, data));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');

      if (['23000', '23505'].includes(error.code)) {
        throw ConcurrencyException.with(error.message);
      }

      if (error.code !== '0000') {
        throw ConcurrencyException.with(error.message);
      }

      throw error;
    } finally {
      client.release();

      await this.writeLock.releaseLock(lock);
    }
  }

  public async load(streamName: string, fromNumber: number, count?: number, matcher?: IMetadataMatcher, middleware: WrappedMiddleware[] = []): Promise<AsyncIterable<IEvent>> {
    const { query, values } = await this.createQuery(streamName, fromNumber, matcher);
    const queryConfig = {
      text: query,
      values,
      // @ts-ignore
      types: { getTypeParser },
    };

    const iterator = new PostgresIterator(this.client, queryConfig, this.eventMap, middleware);

    return iterator.iterator;
  }

  public async mergeAndLoad(streams: Array<LoadStreamParameter>, middleware: WrappedMiddleware[] = []): Promise<AsyncIterable<IEvent>> {
    let paramCounter = 0;
    let queries = [];
    let parameters = [];

    for (const { streamName, fromNumber = 1, matcher } of streams) {
      const { query, values } = await this.createQuery(streamName, fromNumber, matcher, paramCounter);

      paramCounter += values.length;

      queries.push(query);
      parameters.push(values);
    }

    let query = queries[0];

    if (queries.length > 1) {
      query = queries.map(query => `(${query})`).join(' UNION ALL ') + ' ORDER BY created_at ASC';
    }

    const params = parameters.reduce<Array<any>>((params, values) => [...params, ...values], []);
    const queryConfig = {
      text: query,
      values: params,
      // @ts-ignore
      types: { getTypeParser },
    };

    const iterator = new PostgresIterator(this.client, queryConfig, this.eventMap, middleware);

    return iterator.iterator;
  }

  private async createQuery(streamName: string, fromNumber: number, matcher?: IMetadataMatcher, paramCounter = 0) {
    const result = await this.client.query(`SELECT stream_name FROM ${EVENT_STREAMS_TABLE} WHERE real_stream_name = $1`, [streamName]);

    if (result.rowCount === 0) {
      throw StreamNotFound.withName(streamName);
    }

    const tableName = generateTable(streamName);

    const { where, values } = this.createWhereClause(matcher, paramCounter);

    where.push(`no > $${paramCounter + values.length + 1}`);
    values.push(fromNumber);

    const whereCondition = `WHERE ${where.join(' AND ')}`;

    return {
      query: `SELECT *, '${streamName}' as stream FROM ${tableName} ${whereCondition} ORDER BY no ASC`,
      values,
    };
  }

  private createWhereClause(matcher?: IMetadataMatcher, paramCounter = 0): { where: string[]; values: any[] } {
    const where = [];
    const values = [];

    if (!matcher) return { where, values };

    matcher.data.forEach(match => {
      let expression = (value: string) => '';

      switch (match.operation) {
        case MetadataOperator.IN:
          expression = (value: string) => `= ANY(${value}::text[])`;
          break;
        case MetadataOperator.NOT_IN:
          expression = (value: string) => `NOT IN ANY(${value}::text[])`;
          break;
        case MetadataOperator.REGEX:
          expression = (value: string) => `~ ${value}`;
          break;
        default:
          expression = (value: string) => `${match.operation} ${value}`;
          break;
      }

      if (match.fieldType === FieldType.METADATA) {
        if (typeof match.value === 'boolean') {
          where.push(`metadata->>'${match.field}' ${expression(match.value.toString())}`);

          return;
        }

        paramCounter++;
        values.push(match.value);

        if (typeof match.value === 'number') {
          where.push(`CAST(metadata->>'${match.field}' AS INT) ${expression(`$${paramCounter}`)}`);
        } else {
          where.push(`metadata->>'${match.field}' ${expression(`$${paramCounter}`)}`);
        }
      }

      if (match.fieldType === FieldType.MESSAGE_PROPERTY) {
        if (typeof match.value === 'boolean') {
          where.push(`${match.field} ${expression(match.value.toString())}`);

          return;
        }

        paramCounter++;
        values.push(match.value);

        where.push(`${match.field} ${expression(`$${paramCounter}`)}`);
      }
    });

    return { where, values };
  }
}
