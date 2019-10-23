import { Projection, ProjectionConstructor, ProjectionManager, Projector, State } from "./types";

export abstract class BaseProjection<T extends State> implements Projection<T> {
  private _projector: Projector;

  protected constructor(protected readonly projectionManager: ProjectionManager) {}

  public abstract projectionName: string;
  public abstract run(keepRunning: boolean): Promise<T>;

  protected get projector() {
    if (!this._projector) {
      this._projector = this.projectionManager.createProjector((this.constructor as ProjectionConstructor<BaseProjection<T>>).projectionName);
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
