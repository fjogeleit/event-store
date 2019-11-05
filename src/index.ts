import { PostgresEventStore } from './postgres';
import { InMemoryEventStore } from './in-memory';
import { MysqlEventStore } from './mysql';

import { Configuration, Driver, IEventStore } from './types';
import { Registry } from './registry';

export const EVENT_STREAMS_TABLE = 'event_streams';
export const PROJECTIONS_TABLE = 'projections';

export const createEventStore = ({ connection, connectionString, aggregates, projections, readModelProjections, middleware, driver }: Configuration): IEventStore => {
  if (driver === Driver.IN_MEMORY) {
    return new InMemoryEventStore({
      connectionString: null,
      middleware: middleware || [],
      registry: new Registry(aggregates || [], [], projections || [], readModelProjections || []),
    });
  }

  if (driver === Driver.MYSQL) {
    return new MysqlEventStore({
      connection,
      middleware: middleware || [],
      registry: new Registry(aggregates || [], [], projections || [], readModelProjections || []),
    });
  }

  return new PostgresEventStore({
    connectionString,
    middleware: middleware || [],
    registry: new Registry(aggregates || [], [], projections || [], readModelProjections || []),
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
