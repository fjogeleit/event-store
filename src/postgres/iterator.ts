import { Pool } from 'pg';
import bind from 'bind-decorator';
import { IEventConstructor, IEvent } from '../types';
import { BaseEvent } from "../event";

export class PostgresIterator {
    private limit = 1000;
    private offset = 0;
    private done = false;

    constructor(
        private client: Pool,
        private params: { text: string; values: any[], types: any },
        private readonly eventMap: { [aggregateEvent: string]: IEventConstructor }) {}

    @bind
    private async fetchEvents() {
        const params = { ...this.params, text: `${this.params.text} LIMIT ${this.limit} OFFSET ${this.offset}` };
        const { rows, rowCount } = await this.client.query(params);

        this.offset += rowCount;
        this.done = rowCount < this.limit;

        return rows;
    }

    private async *generatorWrapper(): AsyncGenerator<IEvent> {
        if (this.done) return;

        const events = await this.fetchEvents();

        if (!events.length) return;

        for (const { event_id, payload, event_name, metadata, created_at, stream, no } of events) {
            const EventConstructor = this.eventMap[`${metadata._aggregate_type}:${event_name}`] || BaseEvent;
            yield new EventConstructor(event_name, payload, { ...metadata, stream }, event_id, created_at, parseInt(no, 10));
        }

        yield* this.generatorWrapper();
    }

    async *[Symbol.asyncIterator]() {
        yield* this.generatorWrapper();
    }
}
