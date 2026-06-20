module.exports = async function routes(fastify) {
  fastify.register(require('./auth.routes'), { prefix: '/auth' })
  fastify.register(require('./dashboard.routes'), { prefix: '/dashboard' })
  fastify.register(require('./assets/bankAccounts.routes'), { prefix: '/assets' })
  fastify.register(require('./assets/mutualFunds.routes'), { prefix: '/assets' })
  fastify.register(require('./assets/stocks.routes'), { prefix: '/assets' })
  fastify.register(require('./assets/gold.routes'), { prefix: '/assets' })
  fastify.register(require('./assets/govtSchemes.routes'), { prefix: '/assets' })
  fastify.register(require('./market.routes'), { prefix: '/market' })
}
