import { IReadModel, IReadModelProjectionConstructor } from "../types";

const projections: Array<{ projection: IReadModelProjectionConstructor<any, any>, readModel: IReadModel }> = [];

export const readModelProjectionMap = () => projections;

export const ReadModelProjectionConfig = (config: { name: string, readModel: IReadModel }) => (target: IReadModelProjectionConstructor<any, any>) =>  {
  target.projectionName = config.name;

  projections.push({ projection: target, readModel: config.readModel })
};
