import { Aggregate, IEvent } from "./index";

export abstract class BaseAggregate implements Aggregate {
  protected _recordedEvents: IEvent[] = [];
  protected _version: number = 0;

  protected _recordThat(event) {
    this._version += 1;

    event = event.withVersion(this._version);

    this._recordedEvents.push(event);
    this._apply(event)
  }

  protected _apply(event) {
    const method = `_when${event.name}`;

    if (method in this) {
      this[method](event)
    }
  }

  protected _replay(event) {
    this._version = event.version;
    this._apply(event);

    return this;
  }

  public popEvents() {
    const events = this._recordedEvents;

    this._recordedEvents = [];

    return events;
  }

  public fromHistory(events: IEvent[]) {
    return events.reduce<BaseAggregate>((aggregate, event) => {
      return aggregate._replay(event)
    }, this)
  }
}
