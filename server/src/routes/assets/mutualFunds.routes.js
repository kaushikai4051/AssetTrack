const c = require('../../controllers/assets/mutualFunds.controller')

module.exports = async function mutualFundRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  fastify.get('/mutual-funds', auth, c.list)
  fastify.post('/mutual-funds', auth, c.create)
  fastify.get('/mutual-funds/:id', auth, c.get)
  fastify.put('/mutual-funds/:id', auth, c.update)
  fastify.delete('/mutual-funds/:id', auth, c.remove)

  fastify.get('/mutual-funds/:id/transactions', auth, c.listTransactions)
  fastify.post('/mutual-funds/:id/transactions', auth, c.addTransaction)
  fastify.delete('/mutual-funds/:id/transactions/:txId', auth, c.deleteTransaction)
}
