import { IProjection, IProjectionConstructor, IProjectionManager, IProjector, State } from "./types";

export abstract class Projection<T extends State = State> implements IProjection<T> {
  private _projector: IProjector<T>;

  public constructor(protected readonly projectionManager: IProjectionManager) {}
  public abstract run(keepRunning: boolean): Promise<any>;

  protected get projector() {
    if (!this._projector) {
      this._projector = this.projectionManager.createProjector<T>(
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

  getState(): T {
    return this.projector.getState();
  }
}
