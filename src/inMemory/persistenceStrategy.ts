import {
  FieldType,
  IEvent,
  IEventConstructor,
  LoadStreamParameter,
  IMetadataMatcher,
  MetadataOperator,
  Options
} from "../types";

import { PersistenceStrategy } from "../eventStore";

const cloneDeep = require('lodash.clonedeep');

export class InMemoryPersistenceStrategy implements PersistenceStrategy {
  private readonly eventMap: { [aggregateEvent: string]: IEventConstructor };
  private _eventStreams: { [streamName: string]: IEvent<any>[] } = {};

  constructor(private readonly options: Options) {
    this.eventMap = this.options.aggregates.reduce((eventMap, aggregate) => {
      const items = aggregate.registeredEvents().reduce<{ [aggregateEvent: string]: IEventConstructor }>((item, event) => {
        item[`${aggregate.name}:${event.name}`] = event;

        return item;
      }, {});

      return { ...eventMap, ...items }
    }, {});
  }

  get eventStreams(): { [streamName: string]: IEvent<any>[] } {
    return this._eventStreams;
  }

  public async createEventStreamsTable() {
    this._eventStreams = {};
  };

  public async createProjectionsTable() {};

  public async addStreamToStreamsTable(streamName: string) {
    this._eventStreams[streamName] = [];
  };

  public async removeStreamFromStreamsTable(streamName: string) {
    delete this._eventStreams[streamName];
  };

  public async hasStream(streamName: string) {
    return (streamName in this._eventStreams);
  };

  public async deleteStream(streamName: string) {
    await this.removeStreamFromStreamsTable(streamName);
  };

  public async createSchema(streamName: string) {};

  public async dropSchema(streamName: string) {};

  public async appendTo<T = object>(streamName: string, events: IEvent<T>[]) {
    this._eventStreams[streamName] = [
      ...this._eventStreams[streamName],
      ...events
    ].sort((a, b) => a.metadata._aggregate_version - b.metadata._aggregate_version)
  }

  public async load(streamName: string, fromNumber: number, count?: number, matcher?: IMetadataMatcher) {
    const rows = this.filter(this._eventStreams[streamName].slice(fromNumber - 1, count), matcher);

    return cloneDeep(rows);
  }

  public async mergeAndLoad(streams: Array<LoadStreamParameter>) {
    let events: IEvent<any>[] = [];

    for (const { streamName, fromNumber = 1, matcher } of streams) {
      events = [...events, ...this.filter(this._eventStreams[streamName].slice(fromNumber - 1), matcher)];
    }

    const rows = events.sort((a, b) => {
      return a.createdAt.microtime - b.createdAt.microtime
    });

    return cloneDeep(rows);
  }

  private match(value: any, expected: any, operation: MetadataOperator): boolean {
    switch (operation) {
      case MetadataOperator.IN:
        return expected.includes(value);
      case MetadataOperator.NOT_IN:
        return false === expected.includes(value);
      case MetadataOperator.REGEX:
        return expected.match(new RegExp(value as string));
      case MetadataOperator.EQUALS:
        return expected == value;
      case MetadataOperator.NOT_EQUALS:
        return expected != value;
      case MetadataOperator.LOWER_THAN:
        return value < expected;
      case MetadataOperator.LOWER_THAN_EQUALS:
        return value <= expected;
      case MetadataOperator.GREATER_THAN:
        return value > expected;
      case MetadataOperator.GREATER_THAN_EQUALS:
        return value >= expected;
    }
  }

  private filter(events: IEvent[], matcher?: IMetadataMatcher) {
    if (!matcher) return events;

    matcher.data.forEach((match) => {
      if (match.fieldType === FieldType.METADATA) {
        events = events
          .filter((event) => {
            if (!(match.field in event.metadata)) {
              return false;
            }

            return this.match(event.metadata[match.field], match.value, match.operation)
          });

        return events;
      }

      if (match.fieldType === FieldType.MESSAGE_PROPERTY) {
        events = events
          .filter((event) => {
            switch (match.field) {
              case 'createdAt':
              case 'created_at':
                return this.match(event.createdAt, match.value, match.operation);
              case 'event_name':
              case 'name':
                return this.match(event.name, match.value, match.operation);
              case 'uuid':
                return this.match(event.uuid, match.value, match.operation);
              default:
                return false;
            }
          });

        return events;
      }
    });

    return events;
  }
}
