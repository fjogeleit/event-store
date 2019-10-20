import { EventMetadata, IEvent } from "./index";
import * as uuid from 'uuid/v4';

export class DomainEvent<T = object> implements IEvent<T> {
  protected _metadata: EventMetadata = {
    _aggregate_id: '',
    _aggregate_version: 1
  };

  public constructor(
    protected readonly aggregateId: string,
    protected readonly _payload: T,
    protected readonly _uuid: string = uuid(),
    protected readonly _createdAt: Date = (new Date())
  ) {
    this._metadata._aggregate_id = aggregateId;
  }

  get uuid() {
    return this._uuid;
  }

  get name() {
    return this.constructor.name;
  }

  get metadata() {
    return this._metadata;
  }

  get payload() {
    return this._payload;
  }

  get createdAt() {
    return this._createdAt;
  }

  get version() {
    return this._metadata._aggregate_version;
  }

  public withVersion(version: number): IEvent<T> {
    this._metadata._aggregate_version = version;

    return this;
  }

  public withAggregateType(type: string): IEvent<T> {
    this._metadata._aggregate_type = type;

    return this;
  }

  public withMetadata(metadata: EventMetadata): IEvent<T> {
    this._metadata = { ...metadata };

    return this;
  }
}
