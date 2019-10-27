import { IEventConstructor, IAggregateConstructor } from "../types";
import { AGGREGATE_CONFIG } from "./constants";

const aggregates: IAggregateConstructor[] = [];

export const aggregateMap = () => aggregates;

export const AggregateConfig = (events: IEventConstructor[]) => (target: IAggregateConstructor) =>  {
  Reflect.defineMetadata(AGGREGATE_CONFIG, events, target);

  aggregates.push(target)
};
