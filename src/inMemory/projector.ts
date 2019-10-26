import { IProjectionManager, IProjector, ProjectionStatus, State, Stream } from "../projection/types";
import { IEvent, MetadataMatcher } from "../index";
import { InMemoryEventStore } from "./eventStore";

const cloneDeep = require('lodash.clonedeep');

export class InMemoryProjector<T extends State = State> implements IProjector<T> {
  private state?: T;
  private initHandler?: () => T;
  private handlers?: { [event: string]: <R extends IEvent>(state: T, event: R) => T | Promise<T> };
  private handler?: <R extends IEvent>(state: T, event: R) => T | Promise<T>;
  private metadataMatchers: { [streamName: string]: MetadataMatcher } = {};
  private streamPositions: { [stream: string]: number } = {};

  private streamCreated: boolean = false;
  private isStopped: boolean = false;

  private query: { all: boolean, streams: Array<string> } = { all: false, streams: [] };

  constructor(
    private readonly name: string,
    private readonly manager: IProjectionManager,
    private readonly eventStore: InMemoryEventStore,
    private readonly projections: { [projection: string]: { state: State, positions: object, status: ProjectionStatus } },
    private status: ProjectionStatus = ProjectionStatus.IDLE
  ) {}

  init(callback: () => T): IProjector<T> {
    if (this.initHandler !== undefined) {
      throw new Error(`Projection already initialized`)
    }

    this.initHandler = callback;
    this.initHandler.bind(this);

    this.state = this.initHandler();

    return this;
  }

  fromAll(): IProjector<T> {
    if (this.query.all || this.query.streams.length > 0) {
      throw new Error('From was already called')
    }

    this.query.all = true;

    return this;
  }

  fromStream(stream: Stream): IProjector<T> {
    if (this.query.all || this.query.streams.length > 0) {
      throw new Error('From was already called')
    }

    this.query.streams.push(stream.streamName);
    this.metadataMatchers[stream.streamName] = stream.matcher;

    return this;
  }

  fromStreams(...streams: Stream[]): IProjector<T> {
    if (this.query.all || this.query.streams.length > 0) {
      throw new Error('From was already called')
    }

    this.query.streams = streams.map((stream) => stream.streamName);
    this.metadataMatchers = streams.reduce((matchers, stream) => {
      matchers[stream.streamName] = stream.matcher;

      return matchers;
    }, {});

    return this;
  }

  when(handlers: { [p: string]: (state: T, event: IEvent) => T }): IProjector<T> {
    if (this.handler || this.handlers) {
      throw new Error('When was already called')
    }

    Object.values(handlers).forEach(handler => handler.bind(this));

    this.handlers = { ...handlers };

    return this;
  }

  whenAny(handler: (state: T, event: IEvent) => T): IProjector<T> {
    if (this.handler || this.handlers) {
      throw new Error('When was already called')
    }

    handler.bind(this);

    this.handler = handler;

    return this;
  }

  async emit(event: IEvent<object>): Promise<void> {
    if (this.streamCreated === false && (await this.eventStore.hasStream(this.name)) === false) {
      await this.eventStore.createStream(this.name);
      this.streamCreated = true;
    }

    this.linkTo(this.name, event);
  }

  async linkTo(streamName: string, event: IEvent<object>): Promise<void> {
    if ((await this.eventStore.hasStream(this.name)) === false) {
      await this.eventStore.createStream(this.name);
    }

    await this.eventStore.appendTo(this.name, [event]);
  }

  async delete(deleteEmittedEvents: boolean = false): Promise<void> {
    delete this.projections[this.name];

    if (deleteEmittedEvents) {
      await this.eventStore.deleteStream(this.name)
    }

    this.isStopped = true;
    this.state = undefined;

    if (this.initHandler !== undefined) {
      this.state = this.initHandler()
    }

    this.streamPositions = {};
  }

  async reset(): Promise<void> {
    this.streamPositions = {};
    this.state = undefined;

    if (this.initHandler !== undefined) {
      this.state = this.initHandler()
    }

    this.projections[this.name] = {
      state: {},
      positions: this.streamPositions,
      status: ProjectionStatus.IDLE
    };

    try {
      await this.eventStore.deleteStream(this.name)
    } catch(e) {
      console.error(e)
    }
  }

  async stop(): Promise<void> {
    await this.persist();

    this.isStopped = true;

    await this.manager.idleProjection(this.name);

    this.status = ProjectionStatus.IDLE;
  }

  getName(): string {
    return this.name;
  }

  getState(): T {
    return this.state;
  }

  async run(keepRunning: boolean = false): Promise<void> {
    if (!this.handler && !this.handlers) {
      throw new Error('No handlers configured')
    }

    if (!this.state) {
      throw new Error('No State initialised')
    }

    switch(await this.fetchRemoteStatus()) {
      case ProjectionStatus.STOPPING:
        await this.load();
        await this.stop();
        break;
      case ProjectionStatus.DELETING:
        await this.delete();
        break;
      case ProjectionStatus.DELETING_INCL_EMITTED_EVENTS:
        await this.delete(true);
        break;
      case ProjectionStatus.RESETTING:
        await this.reset();

        if (keepRunning) {
          await this.startAgain();
        }
        break;
    }

    if (await this.projectionExists() === false) {
      await this.createProjection();
    }

    await this.prepareStreamPosition();
    await this.load();

    this.isStopped = false;

    try {
      do {
        const evenStream = await this.eventStore.mergeAndLoad(...Object.entries(this.streamPositions).map(([streamName, position]) => ({
          streamName,
          fromNumber: position + 1,
          matcher: this.metadataMatchers[streamName]
        })));

        if (this.handler) {
          await this.handleStreamWithSingleHandler(evenStream);
        } else {
          await this.handleStreamWithHandlers(evenStream);
        }

        switch(await this.fetchRemoteStatus()) {
          case ProjectionStatus.STOPPING:
            await this.stop();
            break;
          case ProjectionStatus.DELETING:
            await this.delete();
            break;
          case ProjectionStatus.DELETING_INCL_EMITTED_EVENTS:
            await this.delete(true);
            break;
          case ProjectionStatus.RESETTING:
            await this.reset();

            if (keepRunning) {
              await this.startAgain();
            }
            break;
        }

        await this.prepareStreamPosition();

      } while (keepRunning && !this.isStopped);
    } catch (e) {
      console.error(e)
    }
  }

  private async handleStreamWithSingleHandler(eventStreams: IEvent[]) {
    for (const event of eventStreams) {
      this.streamPositions[event.metadata.stream]++;

      this.state = cloneDeep(await this.handler(this.state, event));

      if (this.isStopped) {
        break;
      }
    }
  }

  private async handleStreamWithHandlers(eventStreams: IEvent[]) {
    for (const event of eventStreams) {
      this.streamPositions[event.metadata.stream]++;

      if (this.handlers[event.name] === undefined) {
        if (this.isStopped) {
          break;
        }

        continue;
      }

      this.state = cloneDeep(await this.handlers[event.name](this.state, event));

      if (this.isStopped) {
        break;
      }
    }
  }

  private async persist(): Promise<void> {
    this.projections[this.name] = {
      ...this.projections[this.name],
      state: this.state || {},
      positions: this.streamPositions
    };
  }

  private async load(): Promise<void> {
    try {
      const result = this.projections[this.name];

      if (!result) {
        throw new Error(`Projection ${this.name} was not found`)
      }

      this.streamPositions = { ...this.streamPositions, ...result.positions };
      this.state = { ...(result.state as any) };
    } catch (e) {
      throw new Error(`Projection could not loaded: ${e.toString()}`)
    }
  }

  private async prepareStreamPosition(): Promise<void> {
    let streamPositions = {};

    if (this.query.all) {
      try {
        const result = Object.keys(this.eventStore.eventStreams);

        streamPositions = result.reduce((acc, stream) => {
          acc[stream] = 0;

          return acc;
        }, {});
      } catch (e) {
        throw new Error(`Error by stream position prepare ${e.toString()}`)
      }
    }

    if (this.query.streams.length > 0) {
      streamPositions = this.query.streams.reduce((acc, streamName) => {
        acc[streamName] = 0;

        return acc;
      }, {});
    }

    this.streamPositions = { ...streamPositions, ...this.streamPositions };
  }

  private async fetchRemoteStatus(): Promise<ProjectionStatus> {
    try {
      return await this.manager.fetchProjectionStatus(this.name)
    } catch(e) {
      return ProjectionStatus.RUNNING;
    }
  }

  private async startAgain() {
    this.isStopped = false;
    const now = new Date();

    try {
      if (!this.projections[this.name]) {
        throw new Error(`Projection ${this.name} was not found`)
      }

      this.projections[this.name] = {
        ...this.projections[this.name],
        status: ProjectionStatus.RUNNING
      };
    } catch (error) {
      throw new Error(`ProjectionTable update failed ${error.toString()}`)
    }

    this.status = ProjectionStatus.RUNNING;
  }

  private async projectionExists(): Promise<boolean> {
    try {
      return !!this.projections[this.name];
    } catch (e) {
      throw new Error(`Error by projection exists ${e.toString()}`)
    }
  }

  private async createProjection(): Promise<void> {
    this.projections[this.name] = {
      state: {},
      positions: {},
      status: ProjectionStatus.IDLE
    };
  }
}
