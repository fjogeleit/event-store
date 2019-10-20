const fastify = require('fastify')()
const uuid = require('uuid/v4')
const port = 3000

const eventLog = require('../dist/index')
const User = require('./Model/User/user')
const UserWasRegistered = require('./Model/User/Event/UserWasRegistered')

fastify.register(require('fastify-postgres'), {
  connectionString: 'postgres://user:password@localhost/event-log'
})

fastify.register((fastify, opts, next) => {
  const eventStore = eventLog.createEventStore({
    client: fastify.pg,
    writeLock: eventLog.createWriteLock(fastify.pg),
    eventStreamTable: 'event_streams',
    aggregates: [
      { aggregate: User, events: [UserWasRegistered] }
    ]
  })

  fastify.get('/', async (request, reply) => {
    await eventStore.install()

    reply.type('application/json').code(200)

    return { content: 'success' }
  })

  fastify.get('/append/user/:name', async (request, reply) => {

    try {
      const user = User.register(uuid(), request.params.name, 'password')

      await eventStore.appendTo('users', user._events)
    } catch (e) {
      reply.type('application/json').code(500)

      return { content: e.toString() }
    }

    reply.type('application/json').code(200)

    return { content: 'success' }
  })

  fastify.get('/load', async (request, reply) => {
    try {
      const results = await eventStore.load('users', 0)

      reply.type('application/json').code(200)

      return results.map(event => ({
        name: event.username,
        password: event.password,
        metadata: event._metadata,
        createdAt: event.createdAt,
      }))
    } catch (e) {
      reply.type('application/json').code(500)

      return { content: e.toString() }
    }
  })

  fastify.get('/:streamName', async (request, reply) => {

    try {
      await eventStore.createStream(request.params.streamName)
    } catch (e) {
      reply.type('application/json').code(500)

      return { content: e.toString() }
    }

    reply.type('application/json').code(200)

    return { content: 'success' }
  })

  next()
})

fastify.listen(port, function (err) {
  if (err) throw err
  console.log(`server listening on ${fastify.server.address().port}`)
})
