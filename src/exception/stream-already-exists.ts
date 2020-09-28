export class StreamAlreadyExists extends Error {
  static withName(name: string): StreamAlreadyExists {
    return new StreamAlreadyExists(`Stream with name ${name} already exists`);
  }
}
