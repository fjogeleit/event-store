import {
  IProjectionManager,
  IReadModel,
  IReadModelConstructor,
  IReadModelProjection,
  IReadModelProjectionConstructor,
  IReadModelProjector,
  IState
} from './types';

export abstract class AbstractReadModelProjection<R extends IReadModel, T extends IState> implements IReadModelProjection<R, T> {
  public static projectionName = '';
  public readonly projector: IReadModelProjector<R, T>;
  public readonly readModel: R;

  public constructor(protected readonly projectionManager: IProjectionManager, ReadModelConstructor: IReadModelConstructor<R>) {
    this.projector = this.projectionManager.createReadModelProjector<R, T>(
      (this.constructor as IReadModelProjectionConstructor<R, T>).projectionName,
      ReadModelConstructor
    );

    this.readModel = this.projector.readModel;
  }

  public abstract project(): IReadModelProjector<R, T>;
}
