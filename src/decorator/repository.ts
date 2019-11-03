import { IAggregateConstructor, IAggregateRepositoryConstructor } from '../aggregate';
import 'reflect-metadata';
import { REPOSITORY } from './constants';
import { Registry } from '../registry';

interface RepositoryConfig {
  streamName: string;
  aggregate: IAggregateConstructor;
}

export const Repository = (config: RepositoryConfig) => (target: IAggregateRepositoryConstructor<any>) => {
  target.prototype.streamName = config.streamName;
  target.prototype.aggregate = config.aggregate;

  Reflect.defineMetadata(REPOSITORY, [...(Reflect.getMetadata(REPOSITORY, Registry) || []), target], Registry);
};
