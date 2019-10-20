import {
  DomainEvent,
  ELConfig,
  FieldType,
  IEvent,
  IEventConstructor,
  MetadataMatcher,
  MetadataOperator
} from "../index";
import { Pool } from "pg";
import * as format from "pg-format";

const sha1 = require("sha1");

export const generateTable = (streamName: string): string => {
  return `_${sha1(streamName)}`;
};

interface AggregateCollection {
  [aggregate: string]: { [name: string]: IEventConstructor }
}

export class PostgresPersistenceStrategy {
  private readonly client: Pool;
  private readonly eventMap: AggregateCollection;

  constructor(private readonly options: ELConfig) {
    this.client = options.client;

    this.eventMap = this.options.aggregates.reduce<AggregateCollection>((map, config) => {
      map[config.aggregate.name] = config.events.reduce<{ [name: string]: IEventConstructor }>((events, event) => {
        events[event.name] = event;

        return events;
      }, {});

      return map;
    }, {})
  }

  public async createEventStreamsTable() {
    try {
      const result = await this.client.query('SELECT * FROM pg_catalog.pg_tables WHERE tablename = $1', [
        this.options.eventStreamTable
      ]);

      if (result.rowCount === 1) {
        return;
      }

      await this.client.query(`
          CREATE TABLE ${this.options.eventStreamTable} (
            no BIGSERIAL,
            real_stream_name VARCHAR(150) NOT NULL,
            stream_name CHAR(41) NOT NULL,
            metadata JSONB,
            PRIMARY KEY (no),
            UNIQUE (stream_name)
          );
      `);
    } catch (e) {
      console.error('Failed to install EventStreams Table: %s', e.toString())
    }
  };

  public async createProjectionsTable() {
    try {
      const result = await this.client.query('SELECT * FROM pg_catalog.pg_tables WHERE tablename = $1', [
        'projections'
      ]);

      if (result.rowCount === 1) {
        return;
      }

      await this.client.query(`
          CREATE TABLE projections (
            no BIGSERIAL,
            name VARCHAR(150) NOT NULL,
            position JSONB,
            state JSONB,
            status VARCHAR(28) NOT NULL,
            locked_until CHAR(26),
            PRIMARY KEY (no),
            UNIQUE (name)
          );
      `);
    } catch (e) {
      console.error('Failed to install Projections Table: %s', e.toString())
    }
  };

  public async addStreamToStreamsTable(streamName: string) {
    const tableName = generateTable(streamName);

    try {
      await this.client.query(`INSERT INTO ${this.options.eventStreamTable} (real_stream_name, stream_name, metadata) VALUES ($1, $2, $3)`, [
        streamName, tableName, JSON.stringify([])
      ]);

    } catch (error) {
      if (['23000', '23505'].includes(error.code)) {
        throw new Error(`Stream ${streamName} already exists`)
      }

      throw new Error(`Error ${error.code}: EventStream Table exists? ErrorDetails: ${error.toString()}`)
    }
  };

  public async removeStreamFromStreamsTable(streamName: string) {
    return this.client.query(`DELETE FROM ${this.options.eventStreamTable} WHERE real_stream_name = $1`, [streamName]);
  };

  public async createSchema(streamName: string) {
    const tableName = generateTable(streamName);

    return this.client.query(`
      CREATE TABLE ${tableName} (
          no BIGSERIAL,
          event_id UUID NOT NULL,
          event_name VARCHAR(100) NOT NULL,
          payload JSON NOT NULL,
          metadata JSONB NOT NULL,
          created_at TIMESTAMP(6) NOT NULL,
          PRIMARY KEY (no),
          UNIQUE (event_id)
      );
    `);
  };

  public async dropSchema(streamName: string) {
    const tableName = generateTable(streamName);

    return this.client.query(`DROP TABLE IF EXISTS ${tableName};`);
  };

  public async appendTo(streamName: string, events: IEvent[]) {
    const tableName = generateTable(streamName);

    const data = events.map((event) => [
      event.uuid,
      event.constructor.name,
      JSON.stringify(event.payload),
      JSON.stringify(event.metadata),
      event.createdAt,
    ]);

    const lock = `${tableName}_write_lock`;

    await this.options.writeLock.createLock(lock);

    try {
      await this.client.query(format(`INSERT INTO ${ tableName } (event_id, event_name, payload, metadata, created_at) VALUES %L`, data))
    } catch (error) {
      if (['23000', '23505'].includes(error.code)) {
        throw new Error(`Concurrency Error: ${error.toString()}`)
      }

      if (error.code !== '0000') {
        throw new Error(`Concurrency Error: ${error.toString()}`)
      }

      throw error;
    } finally {
      await this.options.writeLock.releaseLock(lock);
    }
  }

  public async load(streamName: string, fromNumber: number, count?: number, matcher?: MetadataMatcher) {
    const tableName = generateTable(streamName);

    const result = await this.client.query(`SELECT stream_name FROM ${this.options.eventStreamTable} WHERE real_stream_name = $1`, [streamName]);

    if (result.rowCount === 0) {
      throw new Error(`Stream ${streamName} not found`)
    }

    const { where, values } = this.createWhereClause(matcher);

    where.push(`no >= $${values.length + 1}`);
    values.push(fromNumber);

    const whereCondition = `WHERE ${where.join(' AND ')}`;

    const { rows } = await this.client.query(`SELECT * FROM ${tableName} ${whereCondition} ORDER BY no ASC`, values);

    return rows.map<IEvent>(({ event_id, payload, event_name, metadata, created_at }: any) => {
      const EventConstructor = (this.eventMap[metadata._aggregate_type] || {})[event_name] || DomainEvent;

      return (new EventConstructor(
        metadata._aggregate_id,
        payload,
        event_id,
        new Date(created_at)
      )).withMetadata(metadata);
    });
  }

  private createWhereClause(matcher?: MetadataMatcher): { where: string[], values: any[] } {
    const where = [];
    const values = [];

    if (!matcher) return { where, values };

    let paramCounter = 0;

    matcher.data.forEach((match) => {
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

    return { where, values }
  }
}
