import { IProjectionConstructor } from '../projection';
import { PROJECTION } from './constants';
import { Registry } from '../registry';
import { ClassDescriptor, Constructor } from '../types';

export const Projection = (name: string) =>
(classOrDescriptor: IProjectionConstructor<any> | ClassDescriptor) =>
  (typeof classOrDescriptor === 'function')
    ? legacyClass(name, classOrDescriptor)
    : standardClass(name, classOrDescriptor)
;

const legacyClass = (name: string, clazz: IProjectionConstructor<any>) => {
  clazz.projectionName = name;

  Reflect.defineMetadata(PROJECTION, [...(Reflect.getMetadata(PROJECTION, Registry) || []), clazz], Registry);

  return clazz as any;
};

const standardClass = (name: string, descriptor: ClassDescriptor) => {
descriptor.finisher = function(clazz: Constructor<any>) {
  // @ts-ignore
  clazz.projectionName = name;

  Reflect.defineMetadata(PROJECTION, [...(Reflect.getMetadata(PROJECTION, Registry) || []), clazz], Registry);

    return undefined;
  }

  return descriptor;
};

