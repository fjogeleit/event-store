require('dotenv').config({
  path: 'example/.env'
})

const fastify = require('fastify')()
const uuid = require('uuid/v4')
const port = process.env.SERVER_PORT || 3000

const eventLog = require('../dist/index')

const PostgresProjectionManager = require('../dist/postgres/projectionManager').PostgresProjectionManager

const User = require('./Model/User/user')
const UserWasRegistered = require('./Model/User/Event/UserWasRegistered')
const UserNameWasUpdated = require('./Model/User/Event/UserNameWasUpdated')

const Comment = require('./Model/Comment/comment')
const CommentWasWritten = require('./Model/Comment/Event/CommentWasWritten')

fastify.register(require('fastify-postgres'), {
  connectionString: process.env.POSTGRES_CONNECTION
})

fastify.register((fastify, opts, next) => {
  const eventStore = eventLog.createEventStore({
    client: fastify.pg,
    writeLock: eventLog.createWriteLock(fastify.pg),
    eventStreamTable: 'event_streams',
    aggregates: [
      {
        aggregate: User,
        events: [
          UserWasRegistered,
          UserNameWasUpdated
        ]
      }, {
        aggregate: Comment,
        events: [
          CommentWasWritten
        ]
      }
    ]
  })

  const userRepository = eventStore.createRepository('users', User)
  const commentRepository = eventStore.createRepository('comments', Comment)

  eventStore.install()
    .then(() => console.info('EventStore installed'))
    .catch((e) => console.error('Error by prepare the EventStore Tables', e))

  fastify.get('/create-stream/:streamName', async (request, reply) => {

    try {
      await eventStore.createStream(request.params.streamName)
    } catch (e) {
      reply.type('application/json').code(500)

      return { content: e.toString() }
    }

    reply.type('application/json').code(200)

    return { content: 'success' }
  })

  fastify.get('/user/:name/append', async (request, reply) => {

    try {
      const userId = uuid();

      const user = User.register(userId, request.params.name, 'password')

      await userRepository.save(user);

      reply.type('application/json').code(200)

      return { content: { userId } }
    } catch (e) {
      reply.type('application/json').code(500)

      return { content: e.toString() }
    }
  })

  fastify.get('/user/:id', async (request, reply) => {
    try {
      const user = await userRepository.get(request.params.id)

      reply.type('application/json').code(200)

      return {
        id: user.userId,
        name: user.username,
        password: user.password,
      }
    } catch (e) {
      reply.type('application/json').code(500)

      return { content: e.toString() }
    }
  })

  fastify.get('/user/:id/change-name', async (request, reply) => {
    try {
      const user = await userRepository.get(request.params.id);

      if (!request.query.name) {
        throw new Error('Query Parameter name required');
      }

      user.changeUsername(request.query.name);

      await userRepository.save(user);

      reply.type('application/json').code(200)

      return {
        id: user.userId,
        name: user.username,
        password: user.password,
      }
    } catch (e) {
      reply.type('application/json').code(500)

      return { content: e.toString() }
    }
  })

  fastify.get('/user/:id/write-comment', async (request, reply) => {
    try {
      const user = await userRepository.get(request.params.id);

      if (!user) {
        throw new Error(`A user with ID ${request.params.id} was not found`)
      }

      if (!request.query.message) {
        throw new Error('Query Parameter message required');
      }

      const comment = Comment.write(uuid(), request.params.id, request.query.message)
      await commentRepository.save(comment);

      reply.type('application/json').code(200)

      return {
        id: comment.commentId,
        message: comment.message,
        user: comment.userId,
      }
    } catch (e) {
      reply.type('application/json').code(500)

      return { content: e.toString() }
    }
  })

  fastify.get('/user/list', async (request, reply) => {
    try {
      const projectionManager = new PostgresProjectionManager(fastify.pg, eventStore);
      const projector = projectionManager.createProjector('projection_users');

      await projector
        .fromStream({ streamName: 'users' })
        .init(() => ({}))
        .when({
          [UserWasRegistered.name]: (state, event) => {
            state[event.userId] = { id: event.userId, username: event.username, password: event.password };

            return state;
          },
          [UserNameWasUpdated.name]: (state, event) => {
            state[event.userId].username = event.username;

            return state;
          }
        })
        .run(false);

      return Object.values(projector.getState())
    } catch (e) {
      reply.type('application/json').code(500)

      return { content: e.toString() }
    }
  })

  fastify.get('/user/:id/history', async (request, reply) => {
    try {
      const projectionManager = new PostgresProjectionManager(fastify.pg, eventStore);
      const projector = projectionManager.createQuery();

      await projector
        .fromStream({
          streamName: 'users',
          matcher: { data: [{ field: '_aggregate_id', fieldType: 'metadata', operation: '=', value: request.params.id }] }
        })
        .init(() => [])
        .when({
          [UserWasRegistered.name]: async (state, event) => {
            state.push({ event: event.name, username: event.username, password: event.password });

            return state;
          },
          [UserNameWasUpdated.name]: (state, event) => {
            state.push({ event: event.name, username: event.username });

            return state;
          }
        })
        .run();

      return Object.values(projector.getState())
    } catch (e) {
      reply.type('application/json').code(500)

      return { content: e.toString() }
    }
  })

  fastify.get('/user/:id/comments', async (request, reply) => {
    try {
      const projectionManager = new PostgresProjectionManager(fastify.pg, eventStore);
      const projector = projectionManager.createQuery();

      await projector
        .fromStreams({
          streamName: 'users',
          matcher: { data: [{ field: '_aggregate_id', fieldType: 'metadata', operation: '=', value: request.params.id }] }
        }, {
          streamName: 'comments',
          matcher: { data: [{ field: 'userId', fieldType: 'metadata', operation: '=', value: request.params.id }] }
        })
        .init(() => ({}))
        .when({
          [UserWasRegistered.name]: (state, event) => {
            state = { id: event.userId, username: event.username, comments: {} }

            return state;
          },
          [UserNameWasUpdated.name]: (state, event) => {
            state = { ...state, id: event.userId, username: event.username }

            return state;
          },
          [CommentWasWritten.name]: (state, event) => {
            state = { ...state, id: event.userId, comments: { ...state.comments, [event.commentId]: event.message } }

            return state;
          }
        })
        .run();

      return Object.values(projector.getState())
    } catch (e) {
      reply.type('application/json').code(500)

      return { content: e.toString() }
    }
  })

  next()
})

fastify.listen(port, function (err) {
  if (err) throw err
  console.log(`server listening on ${fastify.server.address().port}`)
})
