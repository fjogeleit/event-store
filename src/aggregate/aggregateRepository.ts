import {
  IEventStore,
  FieldType,
  IEvent,
  IEventConstructor,
  IMetadataMatcher,
  MetadataOperator,
  Repository,
  RepositoryConfiguration,
  IAggregate
} from "../types";

import { AggregateNotFound } from "../exception";
import { BaseEvent } from "../event";

interface EventMap {
  [name: string]: IEventConstructor
}

export class AggregateRepository<T extends IAggregate> implements Repository<T> {
  private readonly eventMap: EventMap;
  private readonly eventStore: IEventStore;

  constructor(private readonly options: RepositoryConfiguration<T>) {
    this.eventStore = options.eventStore;
    const AggregateConstructor = options.eventStore.eventMap[options.aggregate.name];

    const events: IEventConstructor[] = (AggregateConstructor || { registeredEvents: () => [] as Array<IEventConstructor> }).registeredEvents();

    this.eventMap = events.reduce<{ [name: string]: IEventConstructor }>((events, event) => {
      events[event.name] = event;

      return events;
    }, {})
  }

  public save(aggregate: T) {
    const events = aggregate.popEvents().map(event => event.withAggregateType(aggregate.constructor.name));

    return this.eventStore.appendTo(this.options.streamName, events)
  }

  public async get(aggregateId: string) {
    const matcher: IMetadataMatcher = {
      data: [
        { operation: MetadataOperator.EQUALS, field: '_aggregate_id', fieldType: FieldType.METADATA, value: aggregateId }
      ]
    };

    const events = await this.eventStore.load(this.options.streamName, 0, matcher);

    let aggregate: T = new this.options.aggregate();

    if (events.length === 0) {
      throw AggregateNotFound.withName(aggregate.constructor.name);
    }

    aggregate.fromHistory(events.map<IEvent>(event => {
      const EventConstructor = this.eventMap[event.name] || BaseEvent;

      return new EventConstructor(event.name, event.payload, event.metadata, event.uuid, event.createdAt.microtime);
    }));

    return aggregate;
  }
}
