import { Database } from 'sqlite3';
import bind from 'bind-decorator';
import { IEvent, IEventConstructor } from '../types';
import { BaseEvent } from "../event";
import { promisifyQuery } from "../helper/sqlite";

const convertDateTime = (dateTimeString: string): number => {
    const date = new Date(dateTimeString);
    const offset = date.getTimezoneOffset() * -1 * 60 * 1000;
    return (date.getTime() + offset) * 1000 + parseInt(dateTimeString.substring(dateTimeString.length - 3));
};

export class SqliteIterator {
    private limit = 1000;
    private offset = 0;
    private done = false;

    constructor(
        private client: Database,
        private params: { query: string; values: any[] },
        private readonly eventMap: { [aggregateEvent: string]: IEventConstructor }) {}

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

        return new EventConstructor(event_name, payload, { ...metadata, stream }, event_id, convertDateTime(created_at), parseInt(no, 10));
    }

    private async *generatorWrapper(): AsyncGenerator<IEvent> {
        if (this.done) return;

        const events = await this.fetchEvents();

        if (!events.length) return;

        for (const event of events) {
            yield this.convertEvent(event)
        }

        yield* this.generatorWrapper();
    }

    async *[Symbol.asyncIterator](): AsyncGenerator<IEvent> {
        yield* this.generatorWrapper();
    }
}
