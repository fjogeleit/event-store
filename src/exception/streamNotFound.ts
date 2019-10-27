export class StreamNotFound extends Error {
  static withName(name: string): StreamNotFound {
    return new this(`Stream with name ${name} was not found`);
  }
}
