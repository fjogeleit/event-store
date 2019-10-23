# EVENT LOG v0.1

Event Log is an EventStore heavily inspired by the prooph/event-store v7.0.

## Implemented:
- **SingleStream Strategy**: Create multiple Streams by yourself and manage them by yourself or the Aggregate Helper
- Event loading and saving to a Stream
- Persistent Projections
- Event Queries
- ReadModel in progress...

### Projections / Queries
- You can query and progress one or multiple Streams with the `fromStream`, `fromStreams`, `fromAll` API.
- Fetch all or a subset of Events with an optional `MetadataMatcher`
- Create persisted State with an `Projector` or temporary created State with a `Query`
- Fetching multiple streams creates a merged stream and run over the events in historical order

## Using the Command Line Tool

The CLI `bin/event-log` supports the usage of Event Log with different helper commands for EventStreams and Projections.

```
Usage: event-log [command] --help

CLI to manage Event Log streams

Options:
  -V, --version                       output the version number
  -c, --config <path>                 Path to your event-log.config file (default: "../event-log.config.js")
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

3. Make the CLI Tool executable with the following command `chmod +x bin/event-log`

### Running the Example

```
# Install the dependencies (including DEV-dependencies)
npm install

# Transpile Typescript
npm run watch

# Run the Example Server
npm run serve
```

- Create a Stream called `users` by using the CLI: `bin/event-log event-stream:create users`
- Create a Stream called `comments` by using the CLI: `bin/event-log event-stream:create comments`

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
