import { Pool } from 'pg';
import bind from 'bind-decorator';
import { IEvent, IEventConstructor } from '../types';
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

    get iterator(): AsyncIterable<IEvent> {
        const _iterator = this;

        const generatorWrapper = async function* () {
            if (_iterator.done) return;

            const events = await _iterator.fetchEvents();

            if (!events.length) return;

            for (const { event_id, payload, event_name, metadata, created_at } of events) {
                const EventConstructor = _iterator.eventMap[`${metadata._aggregate_type}:${event_name}`] || BaseEvent;

                yield new EventConstructor(event_name, payload, metadata, event_id, created_at);
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
