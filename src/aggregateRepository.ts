import {
  Aggregate, BaseEvent,
  EventStore,
  FieldType, IEvent,
  IEventConstructor,
  MetadataMatcher,
  MetadataOperator,
  Repository,
  RepositoryConfiguration
} from "./index";

interface EventMap {
  [name: string]: IEventConstructor
}

export class AggregateRepository<T extends Aggregate> implements Repository<T> {
  private readonly eventMap: EventMap;
  private readonly eventStore: EventStore;

  constructor(private readonly options: RepositoryConfiguration<T>) {
    this.eventStore = options.eventStore;
    this.eventMap = options.events.reduce<{ [name: string]: IEventConstructor }>((events, event) => {
      events[event.name] = event;

      return events;
    }, {});
  }

  public save(aggregate: T) {
    const events = aggregate.popEvents().map(event => event.withAggregateType(aggregate.constructor.name));

    return this.eventStore.appendTo(this.options.streamName, events)
  }

  public async get(aggregateId: string) {
    const matcher: MetadataMatcher = {
      data: [
        { operation: MetadataOperator.EQUALS, field: '_aggregate_id', fieldType: FieldType.METADATA, value: aggregateId }
      ]
    };

    const events = await this.eventStore.load(this.options.streamName, 0, matcher);

    if (events.length === 0) {
      throw new Error('Aggregate not Found')
    }

    let aggregate: T = new this.options.aggregate();

    aggregate.fromHistory(events.map<IEvent>(event => {
      const EventConstructor = this.eventMap[event.name] || BaseEvent;

      return new EventConstructor(event.name, event.payload, event.metadata, event.uuid, event.createdAt);
    }));

    return aggregate;
  }
}
