require('dotenv').config({
  path: 'example/.env'
})

const fastify = require('fastify')()
const uuid = require('uuid/v4')
const port = process.env.SERVER_PORT || 3000

const eventLog = require('../dist/index')
const User = require('./Model/User/user')

const UserWasRegistered = require('./Model/User/Event/UserWasRegistered')
const UserNameWasUpdated = require('./Model/User/Event/UserNameWasUpdated')

fastify.register(require('fastify-postgres'), {
  connectionString: process.env.POSTGRES_CONNECTION
})

fastify.register((fastify, opts, next) => {
  const eventStore = eventLog.createEventStore({
    client: fastify.pg,
    writeLock: eventLog.createWriteLock(fastify.pg),
    eventStreamTable: 'event_streams'
  })

  const userRepository = eventStore.createRepository('users', User, [
    UserWasRegistered,
    UserNameWasUpdated
  ])

  eventStore.install()
    .then(() => console.info('EventStore installed'))
    .catch(() => console.error('Error by prepare the EventStore Tables'))

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

  next()
})

fastify.listen(port, function (err) {
  if (err) throw err
  console.log(`server listening on ${fastify.server.address().port}`)
})
