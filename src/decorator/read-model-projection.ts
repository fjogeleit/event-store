import { IReadModel, IReadModelProjectionConstructor } from '../projection';
import { READ_MODEL_PROJECTION } from './constants';
import { Registry } from '../registry';

interface ReadModelConfig {
  name: string;
  readModel: IReadModel;
}

export const ReadModelProjection = (config: ReadModelConfig) => (target: IReadModelProjectionConstructor<any, any>) => {
  target.projectionName = config.name;

  Reflect.defineMetadata(
    READ_MODEL_PROJECTION,
    [...(Reflect.getMetadata(READ_MODEL_PROJECTION, Registry) || []), { projection: target, readModel: config.readModel }],
    Registry
  );
};
