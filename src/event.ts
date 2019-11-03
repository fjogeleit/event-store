import { EventMetadata, IEvent } from './types';
import { DateTime, IDateTime } from './helper';
import * as uuid from 'uuid/v4';

const microtime = require('microtime');

export class BaseEvent<T = object> implements IEvent<T> {
  public constructor(
    protected _eventName: string,
    protected readonly _payload: T,
    protected readonly _metadata: EventMetadata,
    protected readonly _uuid: string = uuid(),
    protected readonly _microtime: number = microtime.now()
  ) {}

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

  get createdAt(): IDateTime {
    return new DateTime(this._microtime);
  }

  get aggregateId() {
    return this._metadata._aggregate_id;
  }

  get version() {
    return this._metadata._aggregate_version;
  }

  public withVersion(version: number): IEvent<T> {
    return new (this.constructor as any)(
      this._eventName,
      this._payload,
      { ...this._metadata, _aggregate_version: version },
      this._uuid,
      this._microtime
    );
  }

  public withAggregateType(type: string): IEvent<T> {
    return new (this.constructor as any)(this._eventName, this._payload, { ...this._metadata, _aggregate_type: type }, this._uuid, this._microtime);
  }

  public withMetadata(metadata: EventMetadata): IEvent<T> {
    return new (this.constructor as any)(this._eventName, this._payload, metadata, this._uuid, this._microtime);
  }

  public withAddedMetadata(key: string, value: string): IEvent<T> {
    return new (this.constructor as any)(this._eventName, this._payload, { ...this._metadata, [key]: value }, this._uuid, this._microtime);
  }

  public static occur(_aggregateId: string, _payload: object, _uuid: string = uuid(), _microtime: number = microtime.now()) {
    return new (this as any)(
      this.name,
      _payload,
      {
        _aggregate_id: _aggregateId,
        _aggregate_type: '',
        _aggregate_version: 1,
      },
      _uuid,
      _microtime
    );
  }
}
