import {
  IProjectionManager,
  IProjector, IReadModel,
  IReadModelProjection,
  IReadModelProjectionConstructor,
  State
} from "./types";

export abstract class ReadModelProjection<R extends IReadModel, T extends State> implements IReadModelProjection<R, T> {
  private _projector: IProjector;

  protected constructor(protected readonly projectionManager: IProjectionManager, public readonly readModel: R) {}

  public abstract projectionName: string;
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
