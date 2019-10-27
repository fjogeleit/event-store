import { IEventStore, IEvent, IEventConstructor } from "../types";

export interface IAggregateConstructor<T = object> {
  new (): T;
  registeredEvents(): IEventConstructor[];
}

export interface IAggregate {
  popEvents: () => IEvent[]
  fromHistory: (events: IEvent[]) => IAggregate
}

export interface RepositoryConfiguration<T> {
  eventStore: IEventStore;
  aggregate: IAggregateConstructor<T>;
  streamName: string;
}

export interface Repository<T extends IAggregate> {
  save(aggregate: T): Promise<void>;
  get(aggregateId: string): Promise<T>;
}
