import { IReadModel } from "./types";

export abstract class ReadModel implements IReadModel {
  private stacks: Array<{ method: string, args: any[][] }> = [];

  public abstract init(): Promise<void>;
  public abstract isInitialized(): Promise<boolean>;
  public abstract reset(): Promise<void>;
  public abstract delete(): Promise<void>;

  stack(method: string, ...args: any[]): void {
    this.stacks.push({ method, args });
  }

  async persist(): Promise<void> {
    for (const { method, args } of this.stacks) {
      await this[method](...args);
    }
  }
}
