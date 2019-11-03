import { PostgresEventStore } from './postgres';
import { InMemoryEventStore } from './in-memory';

import { Configuration, Driver } from './types';
import { Registry } from './registry';

export const EVENT_STREAMS_TABLE = 'event_streams';
export const PROJECTIONS_TABLE = 'projections';

export const createEventStore = ({ connectionString, aggregates, projections, readModelProjections, middleware, driver }: Configuration) => {
  if (driver === Driver.IN_MEMORY) {
    return new InMemoryEventStore({
      connectionString: null,
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

export * from './postgres';
export * from './in-memory';
export * from './helper';
export * from './event';
export * from './types';
