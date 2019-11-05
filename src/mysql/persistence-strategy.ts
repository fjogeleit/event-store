import { FieldType, IEvent, IEventConstructor, LoadStreamParameter, IMetadataMatcher, MetadataOperator, Options, WriteLockStrategy } from '../types';

import { Pool } from 'mysql';
import { BaseEvent } from '../event';
import { createMysqlPool, DateTime, promisifyQuery } from '../helper';
import { MysqlWriteLockStrategy } from './write-lock-strategy';
import { PersistenceStrategy } from '../event-store';
import { StreamAlreadyExists, StreamNotFound } from '../exception';
import { EVENT_STREAMS_TABLE, PROJECTIONS_TABLE } from '../index';

const sha1 = require('js-sha1');

export const generateTable = (streamName: string): string => {
  return `_${sha1(streamName)}`;
};

const convertDateTime = (dateTimeString: string): number => {
  const date = new Date(dateTimeString);
  const offset = date.getTimezoneOffset() * -1 * 60 * 1000;
  return (date.getTime() + offset) * 1000 + parseInt(dateTimeString.substring(dateTimeString.length - 3));
};

export class MysqlPersistenceStrategy implements PersistenceStrategy {
  private readonly client: Pool;
  private readonly eventMap: { [aggregateEvent: string]: IEventConstructor };
  private readonly writeLock: WriteLockStrategy;

  constructor(private readonly options: Options) {
    this.client = createMysqlPool(options.connection);
    this.writeLock = new MysqlWriteLockStrategy(this.client);

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
      const result = await promisifyQuery<number>(
        this.client,
        'SHOW TABLES LIKE ?',
        [EVENT_STREAMS_TABLE],
        (result: Array<any>) => result.length
      );

      if (result === 1) {
        return;
      }

      await promisifyQuery<void>(
        this.client,
        `
          CREATE TABLE ${EVENT_STREAMS_TABLE} (
            no BIGINT(20) NOT NULL AUTO_INCREMENT,
            real_stream_name VARCHAR(150) NOT NULL,
            stream_name CHAR(41) NOT NULL,
            metadata JSON,
            PRIMARY KEY (no),
            UNIQUE KEY ix_rsn (real_stream_name)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;`,
        [],
        () => {}
      );
    } catch (e) {
      console.error('Failed to install EventStreams Table: %s', e.toString(), e.stack);
    }
  }

  public async createProjectionsTable() {
    try {
      const result = await promisifyQuery<number>(
        this.client,
        'SHOW TABLES LIKE ?',
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
            no BIGINT(20) NOT NULL AUTO_INCREMENT,
            name VARCHAR(150) NOT NULL,
            position JSON,
            state JSON,
            status VARCHAR(28) NOT NULL,
            locked_until CHAR(26),
            PRIMARY KEY (no),
            UNIQUE KEY ix_name (name)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;`,
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
      await promisifyQuery<void>(
        this.client,
        `INSERT INTO ${EVENT_STREAMS_TABLE} SET ?`,
        {
          real_stream_name: streamName,
          stream_name: tableName,
          metadata: JSON.stringify([]),
        },
        () => {}
      );
    } catch (error) {
      if (error.code === '23000') {
        throw StreamAlreadyExists.withName(streamName);
      }

      throw new Error(`Error ${error.code}: EventStream Table exists? ErrorDetails: ${error.toString()}`);
    }
  }

  public async removeStreamFromStreamsTable(streamName: string) {
    await promisifyQuery<void>(
      this.client,
      `DELETE FROM ${EVENT_STREAMS_TABLE} WHERE real_stream_name = ?`,
      [streamName],
      () => {}
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

    await this.client.query(`
      CREATE TABLE ${tableName} (
        no BIGINT(20) NOT NULL AUTO_INCREMENT,
        event_id CHAR(36) COLLATE utf8mb4_bin NOT NULL,
        event_name VARCHAR(100) COLLATE utf8mb4_bin NOT NULL,
        payload JSON NOT NULL,
        metadata JSON NOT NULL,
        created_at DATETIME(6) NOT NULL,
        aggregate_version INT(11) UNSIGNED GENERATED ALWAYS AS (JSON_EXTRACT(metadata, '$._aggregate_version')) STORED NOT NULL,
        aggregate_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(metadata, '$._aggregate_id'))) STORED NOT NULL,
        aggregate_type VARCHAR(150) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(metadata, '$._aggregate_type'))) STORED NOT NULL,
        PRIMARY KEY (no),
        UNIQUE KEY ix_event_id (event_id),
        UNIQUE KEY ix_unique_event (aggregate_type, aggregate_id, aggregate_version),
        KEY ix_query_aggregate (aggregate_type,aggregate_id,no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;`);
  }

  public async dropSchema(streamName: string) {
    const tableName = generateTable(streamName);

    await this.client.query(`DROP TABLE IF EXISTS ${tableName};`);
  }

  public async appendTo<T = object>(streamName: string, events: IEvent<T>[]) {
    const tableName = generateTable(streamName);

    const data = events.map(event => ({
      event_id: event.uuid,
      event_name: event.name,
      payload: JSON.stringify(event.payload),
      metadata: JSON.stringify(event.metadata),
      created_at: event.createdAt.toISOString(),
    }));

    const lock = `${tableName}_write_lock`;

    if (await this.writeLock.createLock(lock) === false) {
      throw new Error('Concurrency Error: Failed to acquire lock for writing to stream');
    }

    try {
      await new Promise((resolve, reject) => {
        this.client.getConnection((error, connection) => {
          if (error) {
            reject(error);
            return;
          }

          connection.beginTransaction((error) => {
            if (error) {
              reject(error);
              return;
            }

            connection.query(`INSERT INTO ${ tableName } SET ?`, data, (error) => {
              if (error) {
                connection.rollback(error => {
                  reject(error);
                });

                reject(error);
                return;
              }

              connection.commit((error) => {
                if (error) {
                  connection.rollback(error => {
                    reject(error);
                  });

                  reject(error);
                  return;
                }

                resolve();
              });
            })
          })
        });
      });
    } catch (error) {
      throw error
    } finally {
      await this.writeLock.releaseLock(lock);
    }
  }

  public async load(streamName: string, fromNumber: number, count?: number, matcher?: IMetadataMatcher) {
    const { query, values } = await this.createQuery(streamName, fromNumber, matcher);

    const rows = await promisifyQuery<Array<any>>(this.client, query, values);

    return rows.map<IEvent>(this.convertEvent);
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
      query = queries.map(query => `(${query})`).join(' UNION ALL ') + ' ORDER BY created_at ASC';
    }

    const params = parameters.reduce<Array<any>>((params, values) => [...params, ...values], []);

    const rows = await promisifyQuery<Array<any>>(this.client, query, params);

    return rows.map<IEvent>(this.convertEvent);
  }

  private convertEvent = ({ event_id, payload, event_name, metadata, created_at, stream }: any) => {
    metadata = JSON.parse(metadata);
    payload = JSON.parse(payload);

    const EventConstructor = this.eventMap[`${metadata._aggregate_type}:${event_name}`] || BaseEvent;

    return new EventConstructor(event_name, payload, { ...metadata, stream }, event_id, convertDateTime(created_at));
  };

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
      query: `SELECT *, '${streamName}' as stream FROM ${tableName} ${whereCondition} ORDER BY no ASC`,
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
        where.push(`JSON_UNQUOTE(metadata->"$.${match.field}") ${expression(`?`)}`);
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
