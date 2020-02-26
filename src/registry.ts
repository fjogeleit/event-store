import 'reflect-metadata';
import { IAggregateConstructor, IAggregateRepositoryConstructor } from './aggregate';
import { AGGREGATE, PROJECTION, READ_MODEL_PROJECTION, REPOSITORY } from './decorator';
import {
  IProjectionConstructor,
  IReadModel,
  IReadModelConstructor,
  IReadModelProjectionConstructor
} from './projection';

export class Registry {
  constructor(
    private readonly _aggregates: IAggregateConstructor[] = [],
    private readonly _repositories: IAggregateRepositoryConstructor<any>[] = [],
    private readonly _projections: IProjectionConstructor[] = [],
    private readonly _readModelProjections: Array<{
      projection: IReadModelProjectionConstructor<any, any>;
      readModel: IReadModel;
    }> = []
  ) {}

  get repositories(): IAggregateRepositoryConstructor<any>[] {
    return [...(Reflect.getMetadata(REPOSITORY, Registry) || []), ...this._repositories];
  }

  get projections(): IProjectionConstructor<any>[] {
    return [...(Reflect.getMetadata(PROJECTION, Registry) || []), ...this._projections];
  }

  get readModelProjections(): Array<{
    projection: IReadModelProjectionConstructor<any, any>;
    readModel: IReadModelConstructor<any>;
  }> {
    return [...(Reflect.getMetadata(READ_MODEL_PROJECTION, Registry) || []), ...this._readModelProjections];
  }

  get aggregates(): IAggregateConstructor[] {
    return [...(Reflect.getMetadata(AGGREGATE, Registry) || []), ...this._aggregates];
  }
}
