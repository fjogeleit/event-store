import { Configuration, Options } from "../types";
import { MysqlParameter } from "../helper";

export interface MysqlConfiguration extends Configuration {
  connection: MysqlParameter;
}

export interface MysqlOptions extends Options {
  connection?: MysqlParameter;
}
