import { IEvent } from '../types';

export class InMemoryIterator {
    constructor(private events: IEvent[]) {}

    get iterator(): AsyncIterable<IEvent> {
        const _iterator = this;

        return {
            [Symbol.asyncIterator]: async function* () {
                for (const event of _iterator.events) {
                    yield event;
                }
            }
        }
    }
}
