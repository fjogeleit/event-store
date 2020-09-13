export interface IDateTime {
  microtime: number;
  toString(): string;
  toISOString(): string;
  toDate(): Date;
}

export interface IDateTimeConstructor {
  new (microtime: number): IDateTime;
  now(): IDateTime;
}

export interface Client<T> {
  readonly connection: T;

  exists(collection: string): Promise<boolean>
  delete(collection: string): Promise<void>
  reset(collection: string): Promise<void>

  insert(collection: string, values: Values): Promise<void>;
  update(collection: string, values: Values, identifiers: Identifiers): Promise<void>;
  remove(collection: string, identifiers: Identifiers): Promise<void>;
}

export interface Values {
  [column: string]: any;
}

export interface Identifiers {
  [column: string]: any;
}
