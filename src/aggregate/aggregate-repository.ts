import { IEventStore, FieldType, IMetadataMatcher, MetadataOperator, IEvent } from '../types';

import { AggregateNotFound } from '../exception';
import { IAggregate, IAggregateConstructor, IAggregateRepository, RepositoryConfiguration } from './types';

export class AggregateRepository<T extends IAggregate> implements IAggregateRepository<T> {
  private readonly eventStore: IEventStore;
  private readonly streamName: string;
  private readonly aggregate: IAggregateConstructor<T>;

  constructor(config?: RepositoryConfiguration<T>) {
    if (config) {
      this.eventStore = config.eventStore;
      this.streamName = config.streamName;
      this.aggregate = config.aggregate;
    }
  }

  public save(aggregate: T) {
    const events = aggregate.popEvents();

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
    const history: IEvent[] = [];

    for await (const event of events) {
      history.push(event);
    }

    let aggregate: T = new this.aggregate();

    if (history.length === 0) {
      throw AggregateNotFound.with(aggregate.constructor.name, aggregateId);
    }

    aggregate.fromHistory(history);

    return aggregate;
  }
}
