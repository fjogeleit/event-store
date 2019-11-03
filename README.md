# Event-Store v0.1

Event Log is an EventStore heavily inspired by the prooph/event-store v7.0.

## Implemented:
- **SingleStream Strategy**: Create a Stream for each Aggregate
- Loading and Saving Aggregates
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

## Initialise the EventStore

### Create the EventStore in your Backend

```
# main.ts

import { createEventStore } from '@fj/event-store';

const eventStore = createEventStore({
  // Postgres ConnectionString  
  connectionString: 'postgres://user:password@localhost:5432/event-store',
  // Driver, possible options are "postgres" (default) and "in_memory"
  driver: 'postgres'
});

// Creates the event_streams and projections tables if they not exist
await eventStore.install();
```

### Create a new EventStream with the integrated CLI helper

```
./node_modules/.bin/event-store event-stream:create <streamName>
```

### Create an Aggregate with the related Events using the included Decorator

Create a basic events with immutable values and payload autocomplete
```
# model/todo/event/todo-was-added.ts

import { BaseEvent } from '@fj/event-store';

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
```
# model/todo/todo.ts

import { AbstractAggregate } from '@fj/event-store';
import { Aggregate } from '@fj/event-store';
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

```
# model/todo/todo-repository.ts

import { AggregateRepository, Repository } from '@fj/event-store';
import { Todo } from './todo';

@Repository({ streamName: 'todos', aggregate: Todo })
export class TodoRepository extends AggregateRepository<Todo> {}
```

### Finally use your Aggregate and Repository to create and persist a Todo

```
# main.ts

import * as uuid from 'uuid/v4'
import { createEventStore } from '@fj/event-store';
import { Todo, TodoRepository } from './todo/model';

(async () => {
    const eventStore = createEventStore({
      connectionString: 'postgres://user:password@localhost:5432/event-store',
      driver: 'postgres'
    });
    
    await eventStore.install();

    const todo = Todo.add(
        uuid(),
        'Using @fj/event-store',
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

```
# projection/todo/todo-list.ts

import { AbstractProjection } from 'event-log';
import { Projection, IProjector } from 'event-log';
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

```
# main.ts
....

(async () => {
    ...

    const projector = eventStore.getProjector<TodoListState>(TodoListProjection.projectionName);
    
    await projector.run(false);
    
    projector.getState()
})();
``` 

## Using the Command Line Tool

The CLI `node/modules/.bin/event-store` supports the usage of EventStore with different helper commands for EventStreams and Projections.

```
Usage: event-store [command] --help

CLI to manage EventStore streams

Options:
  -V, --version                       output the version number
  -c, --config <path>                 Path to your event-store.config file (default: "../event-store.config.js")
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

1. A running Postgres DB. - You can yous the docker-compose.yaml to start one over docker

2. Create your .env File under `./example`. - You can copy and rename the `.env.default` to `.env and change the values to your configuration

3. Make the CLI Tool executable with the following command `chmod +x bin/event-store`

### Running the Example

```
# Install the dependencies (including DEV-dependencies)
npm install

# Transpile Typescript
npm run watch

# Run the Example Server
npm run serve
```

- Create a Stream called `users` by using the CLI: `bin/event-store event-stream:create users`
- Create a Stream called `comments` by using the CLI: `bin/event-store event-stream:create comments`

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
