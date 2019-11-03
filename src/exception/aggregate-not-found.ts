export class AggregateNotFound extends Error {
  static withName(name: string): AggregateNotFound {
    return new this(`A Aggregate with name ${name} does not exists`);
  }
}
