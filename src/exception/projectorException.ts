export class ProjectorException extends Error {
  static fromWasAlreadyCalled(): ProjectorException {
    return new this('From was already called');
  }

  static whenWasAlreadyCalled(): ProjectorException {
    return new this('When was already called');
  }

  static alreadyInitialized(): ProjectorException {
    return new this('Projection already initialized');
  }

  static noHandler(): ProjectorException {
    return new this('No handlers configured');
  }

  static stateWasNotInitialised(): ProjectorException {
    return new this('No State initialised');
  }
}
