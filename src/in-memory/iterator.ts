import { IEvent } from '../types';

export class InMemoryIterator {
    constructor(private readonly events: IEvent[]) {}

    async *[Symbol.asyncIterator](): AsyncGenerator<IEvent> {
        for (const event of this.events) {
            yield event;
        }
    }
}
