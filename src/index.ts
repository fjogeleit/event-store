import { PostgresEventStore } from './postgres';
import { InMemoryEventStore } from './in-memory';
import { MysqlEventStore } from './mysql';

import { Driver, IEventStore, MysqlConfiguration, PostgresConfiguration, InMemoryConfiguration } from './types';
import { Registry } from './registry';

export const EVENT_STREAMS_TABLE = 'event_streams';
export const PROJECTIONS_TABLE = 'projections';

export function createEventStore(config: MysqlConfiguration): MysqlEventStore;
export function createEventStore(config: PostgresConfiguration): PostgresEventStore;
export function createEventStore(config: InMemoryConfiguration): InMemoryEventStore;

export function createEventStore(configuration): IEventStore {
  if (configuration.driver === Driver.POSTGRES) {
    return new PostgresEventStore({
      connectionString: configuration.connectionString,
      middleware: configuration.middleware || [],
      registry: new Registry(
          configuration.aggregates || [],
          [],
          configuration.projections || [],
          configuration.readModelProjections || []
        ),
    });
  }

  if (configuration.driver === Driver.MYSQL) {
    return new MysqlEventStore({
      connection: configuration.connection,
      middleware: configuration.middleware || [],
      registry: new Registry(
          configuration.aggregates || [],
          [],
          configuration.projections || [],
          configuration.readModelProjections || []
        ),
    });
  }

  return new InMemoryEventStore({
    middleware: configuration.middleware || [],
    registry: new Registry(
        configuration.aggregates || [],
        [],
        configuration.projections || [],
        configuration.readModelProjections || []
      ),
  });
};

export * from './helper';
export * from './event';
export * from './types';
export * from './middleware';
export * from './aggregate';
export * from './decorator';
export * from './projection';
export * from './exception';
export * from './in-memory';
export * from './postgres';
