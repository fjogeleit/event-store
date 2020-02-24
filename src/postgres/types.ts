import { Configuration, Options } from "../types";

export interface PostgresConfiguration extends Configuration {
  connectionString?: string;
}

export interface PostgresOptions extends Options {
  connectionString?: string;
}
