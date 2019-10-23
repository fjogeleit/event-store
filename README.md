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

## Run the example

### Requirements

1. A running Postgres DB. - You can yous the docker-compose.yaml to start one over docker

2. Create your .env File under `./example`. - You can copy and rename the `.env.default` to `.env and change the values to your configuration

### Running the Example

```
# Install the dependencies (including DEV-dependencies)
npm install

# Transpile Typescript
npm run watch

# Run the Example Server
npm run serve
```

3. Create a Stream called `users` by using the CreatStream API: `http://localhost:3000/create-stream/users`
4. Create a Stream called `comments` by using the CreatStream API: `http://localhost:3000/create-stream/comments`

After the Server started you should see the Message `EventStore installed` in your Terminal if the DB preparation was succeeded

### Existing APIs are

```
Create a Strem:
http://localhost:3000/create-stream/:streamName
(Returns the UserID you can fetch afterwards)

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

Query multilpe StreamEvents: User CommentHistory:
http://localhost:3000/user/:id/comments
```
