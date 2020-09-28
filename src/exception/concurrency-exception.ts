export class ConcurrencyException extends Error {
  static with(message: string): ConcurrencyException {
    return new ConcurrencyException(`Concurrency Error: ${message}`);
  }
}
