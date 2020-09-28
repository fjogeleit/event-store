export class StreamNotFound extends Error {
  static withName(name: string): StreamNotFound {
    return new StreamNotFound(`Stream with name ${name} was not found`);
  }
}
