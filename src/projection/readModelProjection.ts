import {
  IProjectionManager,
  IProjector,
  IReadModel,
  IReadModelProjection,
  IReadModelProjectionConstructor,
  IState
} from "./types";

export abstract class ReadModelProjection<R extends IReadModel, T extends IState> implements IReadModelProjection<R, T> {
  public static projectionName = '';
  private _projector: IProjector;

  public constructor(protected readonly projectionManager: IProjectionManager, public readonly readModel: R) {}

  public abstract run(keepRunning: boolean): Promise<T>;

  protected get projector() {
    if (!this._projector) {
      this._projector = this.projectionManager.createReadModelProjector<R, T>(
        (this.constructor as IReadModelProjectionConstructor<R, T>).projectionName,
        this.readModel
      );
    }

    return this._projector;
  }

  async reset() {
    return this.projector.reset();
  }

  async delete(deleteEmittedEvents: boolean) {
    return this.projector.delete(deleteEmittedEvents);
  }
}
