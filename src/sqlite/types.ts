import { Configuration, Options } from "../types";

export interface SqliteConfiguration extends Configuration {
  connectionString?: string;
}

export interface SqliteOptions extends Options {
  connectionString?: string;
}
