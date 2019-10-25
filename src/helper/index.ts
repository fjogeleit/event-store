export interface Client<T> {
  readonly connection: T

  insert(collection: string, values: Values): Promise<void>;
  update(collection: string, values: Values, identifiers: Identifiers): Promise<void>;
  delete(collection: string, identifiers: Identifiers): Promise<void>;
}

export interface Values {
  [column: string]: any;
}

export interface Identifiers {
  [column: string]: any;
}
