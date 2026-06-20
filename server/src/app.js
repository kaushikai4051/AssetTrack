const fastify = require('fastify')({
  logger:
    process.env.NODE_ENV === 'development'
      ? { level: process.env.LOG_LEVEL || 'info', transport: { target: 'pino-pretty', options: { colorize: true } } }
      : { level: process.env.LOG_LEVEL || 'info' },
})

const config = require('./config')

// Core plugins
fastify.register(require('@fastify/cookie'))
fastify.register(require('@fastify/cors'), {
  origin: config.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})
fastify.register(require('@fastify/rate-limit'), {
  max: 200,
  timeWindow: '1 minute',
})
fastify.register(require('@fastify/jwt'), {
  secret: config.jwt.accessSecret,
  sign: { expiresIn: config.jwt.accessExpiry },
})

// App plugins (DB + Redis)
fastify.register(require('./plugins/db'))
fastify.register(require('./plugins/redis'))

// Decorate authenticate hook so routes can reference it
fastify.decorate('authenticate', require('./middleware/authenticate'))

// Error handler
fastify.setErrorHandler(require('./middleware/errorHandler'))

// Health check — no auth required
fastify.get('/api/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  env: config.env,
}))

// All application routes under /api/v1
fastify.register(require('./routes'), { prefix: '/api/v1' })

module.exports = fastify
