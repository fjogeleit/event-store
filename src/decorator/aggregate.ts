import { IEventConstructor } from '../types';
import { AGGREGATE } from './';
import { Registry } from '../registry';
import { IAggregateConstructor } from '../aggregate';

export const Aggregate = (events: IEventConstructor[]) => (target: IAggregateConstructor) => {
  Reflect.defineMetadata(AGGREGATE, events, target);

  Reflect.defineMetadata(AGGREGATE, [...(Reflect.getMetadata(AGGREGATE, Registry) || []), target], Registry);
};
