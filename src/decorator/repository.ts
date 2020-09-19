import { IAggregateConstructor, IAggregateRepositoryConstructor } from '../aggregate';
import 'reflect-metadata';
import { REPOSITORY } from './constants';
import { Registry } from '../registry';
import { ClassDescriptor, Constructor } from '../types';

interface RepositoryConfig {
  streamName: string;
  aggregate: IAggregateConstructor;
}


const legacyClass = ({ streamName, aggregate }, clazz: Constructor<any>) => {
    clazz.prototype.streamName = streamName;
    clazz.prototype.aggregate = aggregate;

    Reflect.defineMetadata(REPOSITORY, [...(Reflect.getMetadata(REPOSITORY, Registry) || []), clazz], Registry);
    // Cast as any because TS doesn't recognize the return type as being a
    // subtype of the decorated class when clazz is typed as
    // `Constructor<HTMLElement>` for some reason.
    // `Constructor<HTMLElement>` is helpful to make sure the decorator is
    // applied to elements however.
    // tslint:disable-next-line:no-any
    return clazz as any;
  };

const standardClass = ({ streamName, aggregate }, descriptor: ClassDescriptor) => {
    const { kind, elements } = descriptor;
    return {
      kind,
      elements,
      // This callback is called once the class is otherwise fully defined
      finisher(clazz: Constructor<any>) {
        clazz.prototype.streamName = streamName;
        clazz.prototype.aggregate = aggregate;

        Reflect.defineMetadata(REPOSITORY, [...(Reflect.getMetadata(REPOSITORY, Registry) || []), clazz], Registry);
      }
    };
  };


export const Repository = (config: RepositoryConfig) => (classOrDescriptor: IAggregateRepositoryConstructor<any> | ClassDescriptor) =>
  (typeof classOrDescriptor === 'function')
    ? legacyClass(config, classOrDescriptor)
    : standardClass(config, classOrDescriptor)
;

