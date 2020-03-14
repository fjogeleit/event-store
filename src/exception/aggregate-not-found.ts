export class AggregateNotFound extends Error {
  static with(name: string, aggregateId: string): AggregateNotFound {
    return new this(`A Aggregate with name ${name} and AggregateID ${aggregateId} does not exists`);
  }
}
