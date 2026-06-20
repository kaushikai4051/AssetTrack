const fp = require('fastify-plugin')
const Redis = require('ioredis')
const config = require('../config')

async function redisPlugin(fastify) {
  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null, // disable auto-reconnect on failure
  })

  let redisAvailable = false

  redis.on('error', () => {}) // suppress repeated error logs after first connect attempt

  try {
    await redis.connect()
    redisAvailable = true
    fastify.log.info('Redis connected')
  } catch {
    fastify.log.warn('Redis unavailable — caching disabled (start Redis to enable)')
  }

  fastify.decorate('redisAvailable', redisAvailable)

  fastify.decorate('redis', redis)
  fastify.addHook('onClose', async () => redis.disconnect())
}

module.exports = fp(redisPlugin, { name: 'redis' })
