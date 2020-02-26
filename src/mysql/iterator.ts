import { Pool } from 'mysql';
import bind from 'bind-decorator';
import { IEvent, IEventConstructor } from '../types';
import { BaseEvent } from "../event";
import { promisifyQuery } from "../helper/mysql";
import { WrappedMiddleware } from "../event-store";

const convertDateTime = (dateTimeString: string): number => {
    const date = new Date(dateTimeString);
    const offset = date.getTimezoneOffset() * -1 * 60 * 1000;
    return (date.getTime() + offset) * 1000 + parseInt(dateTimeString.substring(dateTimeString.length - 3));
};

export class MysqlIterator {
    private limit = 1000;
    private offset = 0;
    private done = false;

    constructor(
        private client: Pool,
        private params: { query: string; values: any[] },
        private readonly eventMap: { [aggregateEvent: string]: IEventConstructor },
        private readonly middleware: WrappedMiddleware[] = []) {}

    @bind
    private async fetchEvents() {
        const params = { ...this.params, query: `${this.params.query} LIMIT ${this.limit} OFFSET ${this.offset}` };
        const rows = await promisifyQuery<Array<any>>(this.client, params.query, params.values);

        this.offset += rows.length;
        this.done = rows.length < this.limit;

        return rows;
    }

    @bind
    private convertEvent({ event_id, payload, event_name, metadata, created_at, stream, no }: any) {
        metadata = JSON.parse(metadata);
        payload = JSON.parse(payload);

        const EventConstructor = this.eventMap[`${metadata._aggregate_type}:${event_name}`] || BaseEvent;

        const event = new EventConstructor(event_name, payload, { ...metadata, stream }, event_id, convertDateTime(created_at), no);

        return this.middleware.reduce<Promise<IEvent>>(async (event, handler) => {
            return handler(await event);
        }, Promise.resolve(event))
    };

    get iterator(): AsyncIterable<IEvent> {
        const _iterator = this;

        const generatorWrapper = async function* () {
            if (_iterator.done) return;

            const events = await _iterator.fetchEvents();

            if (!events.length) return;

            for (const event of events) {
                yield _iterator.convertEvent(event)
            }

            yield* generatorWrapper();
        };

        return {
            [Symbol.asyncIterator]: async function* () {
                yield* generatorWrapper();
            }
        }
    }
}
