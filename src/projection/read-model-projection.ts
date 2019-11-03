import { IProjectionManager, IReadModel, IReadModelProjection, IReadModelProjectionConstructor, IReadModelProjector, IState } from './types';

export abstract class AbstractReadModelProjection<R extends IReadModel, T extends IState> implements IReadModelProjection<R, T> {
  public static projectionName = '';
  public readonly projector: IReadModelProjector<R, T>;

  public constructor(protected readonly projectionManager: IProjectionManager, public readonly readModel: R) {
    this.projector = this.projectionManager.createReadModelProjector<R, T>(
      (this.constructor as IReadModelProjectionConstructor<R, T>).projectionName,
      this.readModel
    );
  }

  public abstract project(): IReadModelProjector<R, T>;
}
