import { IProjection, IProjectionConstructor, IProjectionManager, IProjector, IState } from './types';

export abstract class AbstractProjection<T extends IState = IState> implements IProjection<T> {
  public static projectionName = '';
  protected readonly projector: IProjector<T>;

  public constructor(protected readonly projectionManager: IProjectionManager) {
    this.projector = this.projectionManager.createProjector<T>((this.constructor as IProjectionConstructor<AbstractProjection<T>>).projectionName);
  }

  public abstract project(): IProjector<T>;
}
