import { AggregateConstructor, EventStore, IEvent, IEventConstructor } from "../index";

export interface IAggregate {
  popEvents: () => IEvent[]
  fromHistory: (events: IEvent[]) => IAggregate
  registeredEvents: IEventConstructor[]
}

export interface RepositoryConfiguration<T> {
  eventStore: EventStore;
  aggregate: AggregateConstructor<T>;
  streamName: string;
}

export interface Repository<T extends IAggregate> {
  save: (aggregate: T) => Promise<void>
  get: (aggregateId: string) => Promise<T>
}
