import { PostgresEventStore } from "./postgres";
import { InMemoryEventStore } from "./inMemory";

import { Configuration, Driver } from "./types";

export const EVENT_STREAMS_TABLE = 'event_streams';
export const PROJECTIONS_TABLE = 'projections';

export const createEventStore = ({ connectionString, aggregates, projections, readModelProjections, middleware, driver }: Configuration) => {
  if (driver === Driver.IN_MEMORY) {
    return new InMemoryEventStore({
      connectionString: null,
      aggregates: aggregates || [],
      middleware: middleware || [],
      projections: projections || [],
      readModelProjections: readModelProjections || []
    });
  }

  return new PostgresEventStore({
    connectionString,
    aggregates: aggregates || [],
    middleware: middleware || [],
    projections: projections || [],
    readModelProjections: readModelProjections || []
  });
};

export * from './event'
