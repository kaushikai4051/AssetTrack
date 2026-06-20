const c = require('../controllers/market.controller')

module.exports = async function marketRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  fastify.get('/mf-nav/:schemeCode', auth, c.mfNav)
  fastify.get('/mf-search', auth, c.mfSearch)
  fastify.get('/stock-price/:ticker', auth, c.stockPrice)
  fastify.get('/gold-price', auth, c.goldPrice)
}
