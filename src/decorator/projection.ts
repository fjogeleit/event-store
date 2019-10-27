import { IProjectionConstructor } from "../types";

const projections: IProjectionConstructor[] = [];

export const projectionMap = () => projections;

export const ProjectionConfig = (name: string) => (target: IProjectionConstructor<any>) =>  {
  target.projectionName = name;

  projections.push(target)
};
