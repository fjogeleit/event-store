import {
  FieldType,
  IEvent,
  IEventConstructor,
  LoadStreamParameter,
  IMetadataMatcher,
  MetadataOperator
} from '../types';

import { PersistenceStrategy, WrappedMiddleware } from '../event-store';
import { InMemoryOptions } from "./types";
import { InMemoryIterator } from "./iterator";

const cloneDeep = require('lodash.clonedeep');

export class InMemoryPersistenceStrategy implements PersistenceStrategy {
  private readonly eventMap: { [aggregateEvent: string]: IEventConstructor };
  private _eventStreams: { [streamName: string]: IEvent<any>[] } = {};

  constructor(private readonly options: InMemoryOptions) {
    this.eventMap = this.options.registry.aggregates.reduce((eventMap, aggregate) => {
      const items = aggregate.registeredEvents().reduce<{ [aggregateEvent: string]: IEventConstructor }>((item, event) => {
        item[`${aggregate.name}:${event.name}`] = event;

        return item;
      }, {});

      return { ...eventMap, ...items };
    }, {});
  }

  get eventStreams(): { [streamName: string]: IEvent<any>[] } {
    return this._eventStreams;
  }

  public async createEventStreamsTable() {
    this._eventStreams = {};
  }

  public async createProjectionsTable() {}

  public async addStreamToStreamsTable(streamName: string) {
    this._eventStreams[streamName] = [];
  }

  public async removeStreamFromStreamsTable(streamName: string) {
    delete this._eventStreams[streamName];
  }

  public async hasStream(streamName: string) {
    return streamName in this._eventStreams;
  }

  public async deleteStream(streamName: string) {
    await this.removeStreamFromStreamsTable(streamName);
  }

  public async createSchema(streamName: string) {}

  public async dropSchema(streamName: string) {}

  public async appendTo<T = object>(streamName: string, events: IEvent<T>[]) {
    events = events.sort(
      (a, b) => a.metadata._aggregate_version - b.metadata._aggregate_version
    );

    let no = this._eventStreams[streamName].length + 1;

    for (const event of events) {
      this._eventStreams[streamName].push(event.withNo(no));
    }
  }

  public async load(streamName: string, fromNumber: number, count?: number, matcher?: IMetadataMatcher, middleware: WrappedMiddleware[] = []): Promise<AsyncIterable<IEvent>> {
    const rows = this.filter(this._eventStreams[streamName].slice(fromNumber - 1, count), matcher);

    const iterator = new InMemoryIterator(cloneDeep(rows), middleware);

    return iterator.iterator;
  }

  public async mergeAndLoad(streams: Array<LoadStreamParameter>, middleware: WrappedMiddleware[] = []): Promise<AsyncIterable<IEvent>> {
    let events: IEvent<any>[] = [];

    for (const { streamName, fromNumber = 1, matcher } of streams) {
      events = [...events, ...this.filter(this._eventStreams[streamName].slice(fromNumber - 1), matcher)];
    }

    const rows = events.sort((a, b) => {
      return a.createdAt.microtime - b.createdAt.microtime;
    });

    const iterator = new InMemoryIterator(cloneDeep(rows), middleware);

    return iterator.iterator;
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

    matcher.data.forEach(match => {
      if (match.fieldType === FieldType.METADATA) {
        events = events.filter(event => {
          if (!(match.field in event.metadata)) {
            return false;
          }

          return this.match(event.metadata[match.field], match.value, match.operation);
        });

        return events;
      }

      if (match.fieldType === FieldType.MESSAGE_PROPERTY) {
        events = events.filter(event => {
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
