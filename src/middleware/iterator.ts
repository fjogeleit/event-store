import { IEvent } from '../types';
import { WrappedMiddleware } from '../types';

export class MiddlewareIterator {
    constructor(private readonly events: AsyncIterable<IEvent>,
                private readonly middleware: WrappedMiddleware[]) {}

    async *[Symbol.asyncIterator](): AsyncGenerator<IEvent> {
        for await (const event of this.events) {
            yield this.middleware.reduce<Promise<IEvent>>(async (event: Promise<IEvent>, handler: WrappedMiddleware) => {
                return handler(await event);
            }, Promise.resolve(event));
        }
    }
}
