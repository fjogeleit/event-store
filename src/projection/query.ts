import { IProjectionManager, ProjectionStatus, IQuery, State, Stream } from "./types";
import { IEventStore, IEvent, MetadataMatcher } from "../index";

const cloneDeep = require('lodash.clonedeep');

export class Query<T extends State> implements IQuery {
  private state?: T;
  private initHandler?: () => T;
  private handlers?: { [event: string]: (state: T, event: IEvent) => T | Promise<T> };
  private handler?: (state: T, event: IEvent) => T | Promise<T>;
  private metadataMatchers: { [streamName: string]: MetadataMatcher } = {};

  private isStopped: boolean = false;
  private streamPositions: { [stream: string]: number } = {};

  private query: { all: boolean, streams: Array<string> } = { all: false, streams: [] };

  constructor(
    private readonly manager: IProjectionManager,
    private readonly eventStore: IEventStore,
    private status: ProjectionStatus = ProjectionStatus.IDLE
  ) {}

  init(callback: () => T): IQuery {
    if (this.initHandler !== undefined) {
      throw new Error(`Projection already initialized`)
    }

    this.initHandler = callback;
    this.initHandler.bind(this);

    this.state = this.initHandler();

    return this;
  }

  fromAll(): IQuery {
    if (this.query.all || this.query.streams.length > 0) {
      throw new Error('From was already called')
    }

    this.query.all = true;

    return this;
  }

  fromStream(stream: Stream): IQuery {
    if (this.query.all || this.query.streams.length > 0) {
      throw new Error('From was already called')
    }

    this.query.streams.push(stream.streamName);
    this.metadataMatchers[stream.streamName] = stream.matcher;

    return this;
  }

  fromStreams(...streams: Stream[]): IQuery {
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

  when(handlers: { [p: string]: (state: T, event: IEvent) => T }): IQuery {
    if (this.handler || this.handlers) {
      throw new Error('When was already called')
    }

    Object.values(handlers).forEach(handler => handler.bind(this));

    this.handlers = { ...handlers };

    return this;
  }

  whenAny(handler: (state: T, event: IEvent) => T): IQuery {
    if (this.handler || this.handlers) {
      throw new Error('When was already called')
    }

    handler.bind(this);

    this.handler = handler;

    return this;
  }

  async reset(): Promise<void> {
    this.streamPositions = {};
    this.state = undefined;

    if (this.initHandler !== undefined) {
      this.state = this.initHandler()
    }
  }

  async stop(): Promise<void> {
    this.isStopped = true;

    this.status = ProjectionStatus.IDLE;
  }

  getState(): State {
    return this.state;
  }

  async run(keepRunning: boolean = false): Promise<void> {
    if (!this.handler && !this.handlers) {
      throw new Error('No handlers configured')
    }

    if (!this.state) {
      throw new Error('No State initialised')
    }

    this.isStopped = false;
    await this.prepareStreamPosition();

    try {
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

  private async prepareStreamPosition(): Promise<void> {
    let streamPositions = {};

    if (this.query.all) {
      try {
        streamPositions = (await this.manager.fetchAllProjectionNames()).reduce((acc, streamName) => {
          acc[streamName] = 0;

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
}
