import { IEventStore, FieldType, IEvent, IEventConstructor, IMetadataMatcher, MetadataOperator } from '../types';

import { AggregateNotFound } from '../exception';
import { BaseEvent } from '../event';
import { IAggregate, IAggregateConstructor, IAggregateRepository, RepositoryConfiguration } from './types';

interface EventMap {
  [name: string]: IEventConstructor;
}

export class AggregateRepository<T extends IAggregate> implements IAggregateRepository<T> {
  private readonly eventMap: EventMap;
  private readonly eventStore: IEventStore;
  private readonly streamName: string;
  private readonly aggregate: IAggregateConstructor<T>;

  constructor(config?: RepositoryConfiguration<T>) {
    if (config) {
      this.eventStore = config.eventStore;
      this.streamName = config.streamName;
      this.aggregate = config.aggregate;
    }

    const events: IEventConstructor[] = this.aggregate.registeredEvents();

    this.eventMap = events.reduce<{ [name: string]: IEventConstructor }>((events, event) => {
      events[event.name] = event;

      return events;
    }, {});
  }

  public save(aggregate: T) {
    const events = aggregate.popEvents().map(event => event.withAggregateType(aggregate.constructor.name));

    return this.eventStore.appendTo(this.streamName, events);
  }

  public async get(aggregateId: string) {
    const matcher: IMetadataMatcher = {
      data: [
        {
          operation: MetadataOperator.EQUALS,
          field: '_aggregate_id',
          fieldType: FieldType.METADATA,
          value: aggregateId,
        },
      ],
    };

    const events = await this.eventStore.load(this.streamName, 1, matcher);
    const history = [];

    for await (const event of events) {
      history.push(event);
    }

    let aggregate: T = new this.aggregate();

    if (history.length === 0) {
      throw AggregateNotFound.withName(aggregate.constructor.name);
    }

    aggregate.fromHistory(
      history.map<IEvent>(event => {
        const EventConstructor = this.eventMap[event.name] || BaseEvent;

        return new EventConstructor(event.name, event.payload, event.metadata, event.uuid, event.createdAt.microtime);
      })
    );

    return aggregate;
  }
}
