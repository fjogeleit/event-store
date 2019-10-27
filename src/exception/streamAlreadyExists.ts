export class StreamAlreadyExists extends Error {
  static withName(name: string): StreamAlreadyExists {
    return new this(`Stream with name ${name} already exists`);
  }
}
