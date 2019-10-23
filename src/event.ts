import { EventMetadata, IEvent } from "./index";
import * as uuid from 'uuid/v4';

export class BaseEvent<T = object> implements IEvent<T> {
  public constructor(
    protected _eventName: string,
    protected readonly _payload: T,
    protected readonly _metadata: EventMetadata,
    protected readonly _uuid: string = uuid(),
    protected readonly _createdAt: Date = (new Date())
  ) {
  }

  get uuid() {
    return this._uuid;
  }

  get name() {
    return this._eventName;
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

  get aggregateId() {
    return this._metadata._aggregate_id;
  }

  get version() {
    return this._metadata._aggregate_version;
  }

  public withVersion(version: number): IEvent<T> {
    return new (this.constructor as any)(this._eventName, this._payload, { ...this._metadata, _aggregate_version: version }, this._uuid, this._createdAt);
  }

  public withAggregateType(type: string): IEvent<T> {
    return new (this.constructor as any)(this._eventName, this._payload, { ...this._metadata, _aggregate_type: type }, this._uuid, this._createdAt);
  }

  public withMetadata(metadata: EventMetadata): IEvent<T> {
    return new (this.constructor as any)(this._eventName, this._payload, metadata, this._uuid, this._createdAt);
  }

  public withAddedMetadata(key: string, value: string): IEvent<T> {
    return new (this.constructor as any)(this._eventName, this._payload, { ...this._metadata, [key]: value }, this._uuid, this._createdAt);
  }

  public static occur(
    _aggregateId: string,
    _payload: object,
    _uuid: string = uuid(),
    _createdAt: Date = (new Date())
  ) {
    return new (this as any)(
      this.name, _payload,
      { _aggregate_id: _aggregateId, _aggregate_type: '', _aggregate_version: 1 },
      _uuid,
      _createdAt
    );
  }
}
