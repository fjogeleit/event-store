export class ProjectorException extends Error {
  static fromWasAlreadyCalled(): ProjectorException {
    return new ProjectorException('From was already called');
  }

  static whenWasAlreadyCalled(): ProjectorException {
    return new ProjectorException('When was already called');
  }

  static alreadyInitialized(): ProjectorException {
    return new ProjectorException('Projection already initialized');
  }

  static noHandler(): ProjectorException {
    return new ProjectorException('No handlers configured');
  }

  static stateWasNotInitialised(): ProjectorException {
    return new ProjectorException('No State initialised');
  }
}
