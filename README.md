# Event-Store v0.4

FJ-EventStore is an EventStore heavily inspired by the prooph/event-store v7.0.

## Implemented:
- **SingleStream Strategy**: Create a Stream for each Aggregate
- Loading and saving Aggregates
- Persistent Projections
- ReadModel Projections
- Event Queries

### Projections / Queries
- You can query and process one or multiple Streams with the `fromStream`, `fromStreams`, `fromAll` API.
- Fetch all or a subset of Events with an optional `MetadataMatcher`
- Create persisted State with an `Projector` or temporary created State with a `Query`
- Fetching multiple streams creates a merged stream and run over the events in historical order

## Basic Usage

The usage of this EventStore is recommended with TypeScript to benefit from the implemented autocompletion features for Events, ProjectionStates.
This EventStore also ships with `Decorators` to simplify configuration.

The following descriptions using TypeScript. The integrated example serve using normal JavaScript for reference.

## Example Project based on [NestJS](https://github.com/nestjs/nest)

[FJ EventStore Example](https://github.com/fjogeleit/event-store-example) is a base Project with an example integration in the NodeJS Framework NestJS. The Example includes different APIs to show you the basic features like:
* Implementing Aggregates, Events, Projection, Repositories and so on
* Create and persist a new Aggregate
* Update an existing Aggregate

For a basic overview you can use the code snippets from this example project below

## Initialise the EventStore

### Create the EventStore in your Backend

```ts
// main.ts

import { createPostgresEventStore } from 'fj-event-store/postgres';

const eventStore = createPostgresEventStore({
  // Postgres ConnectionString  
  connectionString: 'postgres://user:password@localhost:5432/event-store'
});

// Creates the event_streams and projections tables if they not exist
await eventStore.install();
```

### Create a new EventStream with the integrated CLI helper

```
event-store event-stream:create <streamName>
```

### Create an Aggregate with the related Events using the included Decorator

Create a basic events with immutable values and payload autocomplete
```ts
// model/todo/event/todo-was-added.ts

import { BaseEvent } from 'fj-event-store';

interface TodoPayload {
  task: string;
  description: string;
  date: string;
}

export class TodoWasAdded extends BaseEvent<TodoPayload> {
  static with(todoId: string, task: string, description: string, date: Date) {
    return this.occur(todoId, { task, description, date: date.toString() });
  }

  get todoId() {
    return this.aggregateId;
  }

  get task() {
    return this._payload.task;
  }

  get description() {
    return this._payload.description;
  }

  get date() {
    return new Date(this._payload.date);
  }
}

```
Create and configure an Todo Aggregate with the `AbstractAggregate` Class and `Aggregate` Decorater to configure them.

Use Aggregate._recordThat to append a new Event to the EventStream of the Aggregate. its not persisted yet.

Each Aggregate calls internal a method with the name-schema `_when${EventClassName}` if it exist. This Method is normally used to set the new State from the Events in the Aggregate.
```ts
// model/todo/todo.ts

import { AbstractAggregate } from 'fj-event-store';
import { Aggregate } from 'fj-event-store';
import { TodoWasAdded } from './event';

@Aggregate([TodoWasAdded])
export class Todo extends AbstractAggregate {
  private _todoId: string;
  private _task: string;
  private _description: string;
  private _checked: boolean;
  private _date: Date;

  public static add(todoId: string, task: string, description: string, date: Date): Todo {
    const self = new this();
    self._recordThat(TodoWasAdded.with(todoId, task, description, date));

    return self;
  }

  protected _whenTodoWasAdded(event: TodoWasAdded) {
    this._todoId = event.aggregateId;
    this._task = event.task;
    this._description = event.description;
    this._date = event.date;
    this._checked = false;
  }

  get todoId(): string {
    return this._todoId;
  }

  get task(): string {
    return this._task;
  }

  get description(): string {
    return this._description;
  }

  get date(): Date {
    return this._date;
  }

  get checked(): boolean {
    return this._checked;
  }
}
```

### Load and save Aggregates with Repositories

Create a Repository for your Aggregate.
Each Repository has 2 methods to save and load aggregates.

```ts
// model/todo/todo-repository.ts

import { AggregateRepository, Repository } from 'fj-event-store';
import { Todo } from './todo';

@Repository({ streamName: 'todos', aggregate: Todo })
export class TodoRepository extends AggregateRepository<Todo> {}
```

### Finally use your Aggregate and Repository to create and persist a Todo

```ts
// main.ts

import * as uuid from 'uuid/v4'
import { createInMemoryEventStore } from 'fj-event-store/in-memory';
import { Todo, TodoRepository } from './todo/model';

(async () => {
    const eventStore = createInMemoryEventStore();
    
    await eventStore.install();

    const todo = Todo.add(
        uuid(),
        'Using fj-event-store',
        'Using EventSourcing in my next NodeJS project',
        new Date()
    );

    repository = new TodoRepository();

    // Persist the new aggregate in your PostgresDB
    await repository.save(todo);

    // Load an Aggregate from your EventStream
    const loadedTodo = repository.get(todo.todoId)
})();
```

## Create and using Projections

### Create a simple persisted Projection

Using the AbstractProjection class and configure them with the helper Decorator

```ts
// projection/todo/todo-list.ts

import { AbstractProjection, Projection, IProjector } from 'fj-event-store';
import { TodoWasAdded } from '../../model/todo/event';

export interface TodoListState {
  [id: string]: { id: string, task: string, date: string, checked: boolean };
}

@Projection('todo_list')
export class TodoListProjection extends AbstractProjection<TodoListState> {
  project(): IProjector<TodoListState> {
    return this
      .projector
      .fromStream({ streamName: 'todos' })
      .init(() => ({}))
      .when({
        [TodoWasAdded.name]: (state, event: TodoWasAdded): TodoListState => {
          return { ...state, [event.todoId]: { id: event.todoId, task: event.task, date: event.date.toString(), checked: false } };
        }
      });
  }
}
```

### Run the projection and get the persisted state

```ts
// main.ts
...

(async () => {
    ...

    const projector = eventStore.getProjector<TodoListState>(TodoListProjection.projectionName);
    
    await projector.run(false);
    
    projector.getState()
})();
``` 

## Using the Command Line Tool

The CLI `event-store` supports the usage of EventStore with different helper commands for EventStreams and Projections.

```bash
Usage: event-store [command] --help

CLI to manage EventStore streams, requires a event-store.config.js config file.

Options:
  -V, --version                       output the version number
  -h, --help                          output usage information

Commands:
  event-stream:create <streamName>    Creates an new EventStream
  event-stream:delete <streamName>    Deletes an existing EventStream
  projection:run [options] <name>     Running a projection
  projection:reset <name>             Reset a projection
  projection:delete [options] <name>  Delete a projection
```

## Run the example

### Requirements

1. A running Postgres DB - You can use the docker-compose.yaml to start a postgres instance as docker container.

```bash
docker-compose up -d postgres
```

2. Create your .env File under `./example`. You can copy and rename the `.env.default` to `.env` and change the values to your configuration

3. Make the CLI Tool executable with the following command `chmod +x bin/event-store`

### Running the Example

```bash
# Install the dependencies (including DEV-dependencies)
npm install

# Install peerDependencies for a Postgres EventStore
npm i pg @types/pg --no-save

# Transpile Typescript
npm run watch

# Run the Example Server
npm run serve
```

After the Server started you should see the Message `EventStore installed` in your Terminal if the DB preparation was succeeded

### Existing APIs are

```
Create a User:
http://localhost:3000/append/user/:username
(Returns the UserID you can fetch afterwards)

Fetch a User Aggregate:
http://localhost:3000/user/:aggregateId
(Returns the latest user state)

Change the Username:
http://localhost:3000/user/:aggregateId/change-name?name=:username
(Returns the updated user)

Write a comment:
http://localhost:3000/user/:aggregateId/write-comment?message=:message
(Returns the updated user)

Create and show a persistend Projection: User List:
http://localhost:3000/user/list
(Returns the updated user)

Query Events: User EventHistory:
http://localhost:3000/user/:id/history
(Returns the updated user)

Query multilpe StreamEvents: User Comment List:
http://localhost:3000/user/:id/comments
```
