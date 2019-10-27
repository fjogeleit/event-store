import { IDateTime } from "./types";

const microtime = require('microtime');

export class DateTime implements IDateTime {
  constructor(private readonly _microtime: number){}

  static now(): IDateTime {
    return new DateTime(microtime.now())
  }

  get microtime() {
    return this._microtime
  }

  toDate() {
    return new Date(Math.floor(this._microtime / 1000));
  }

  toString() {
    return `${this.toDate().toUTCString().replace(' GMT', '')}.${this._microtime.toString().substr(-6)}`
  }
}
