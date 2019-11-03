import { EventAction, EventCallback, IEvent } from '../types';
import * as util from 'util';

const format = (event: IEvent) => {
  return util.inspect(event, false, null, true);
};

export const loggerMiddleware = (logger: Console = console): EventCallback => (event: IEvent, action: EventAction): IEvent => {
  switch (action) {
    case EventAction.PRE_APPEND:
      logger.log(`Event pre appended: %s`, format(event));
      break;
    case EventAction.APPENDED:
      logger.log(`Event appended: %s`, format(event));
      break;
    case EventAction.LOADED:
      logger.log(`Event loaded: %s`, format(event));
      break;
    default:
      logger.log(`Logged: %s`, format(event));
  }

  return event;
};
