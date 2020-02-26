import { IEvent } from '../types';
import { WrappedMiddleware } from "../event-store";

export class InMemoryIterator {
    constructor(private events: IEvent[],
                private readonly middleware: WrappedMiddleware[] = []) {}

    get iterator(): AsyncIterable<IEvent> {
        const _iterator = this;

        return {
            [Symbol.asyncIterator]: async function* () {
                for (const event of _iterator.events) {
                    yield _iterator.middleware.reduce<Promise<IEvent>>(async (event, handler) => {
                        return handler(await event);
                    }, Promise.resolve(event));
                }
            }
        }
    }
}
