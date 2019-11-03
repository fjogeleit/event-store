import { IProjectionConstructor } from '../projection';
import { PROJECTION } from './constants';
import { Registry } from '../registry';

export const Projection = (name: string) => (target: IProjectionConstructor<any>) => {
  target.projectionName = name;

  Reflect.defineMetadata(PROJECTION, [...(Reflect.getMetadata(PROJECTION, Registry) || []), target], Registry);
};
