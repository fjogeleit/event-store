export class ConcurrencyException extends Error {
  static with(message: string) {
    return new this(`Concurrency Error: ${message}`);
  }
}
