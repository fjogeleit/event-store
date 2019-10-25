import { IProjection, IProjectionConstructor, IProjectionManager, IProjector, State } from "./types";

export abstract class Projection<T extends State> implements IProjection<T> {
  private _projector: IProjector;

  protected constructor(protected readonly projectionManager: IProjectionManager) {}

  public abstract projectionName: string;
  public abstract run(keepRunning: boolean): Promise<T>;

  protected get projector() {
    if (!this._projector) {
      this._projector = this.projectionManager.createProjector(
        (this.constructor as IProjectionConstructor<Projection<T>>).projectionName
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
