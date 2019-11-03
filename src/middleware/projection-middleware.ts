import { EventCallback, IEvent, IEventStore } from '../types';
import { IProjector, IReadModelProjector } from '../projection';

export const projectionMiddleware = (done: (eventStore: IEventStore) => void = () => {}): EventCallback => async (
  event,
  _,
  eventStore
): Promise<IEvent> => {
  const projections = eventStore.getProjectionManager().fetchAllProjectionNames();

  await Promise.all(
    projections.map(async name => {
      let projection: IProjector<any> | IReadModelProjector<any, any> = null;

      try {
        projection = eventStore.getProjector<any>(name);
      } catch {}

      try {
        projection = eventStore.getReadModelProjector<any, any>(name);
      } catch {}

      if (!projection) {
        return;
      }

      try {
        await projection.run(false);
      } catch (error) {
        console.warn(error);
      }
    })
  );

  done(eventStore);

  return event;
};
