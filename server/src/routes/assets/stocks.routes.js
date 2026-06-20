const c = require('../../controllers/assets/stocks.controller')

module.exports = async function stockRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  fastify.get('/stocks', auth, c.list)
  fastify.post('/stocks', auth, c.create)
  fastify.get('/stocks/:id', auth, c.get)
  fastify.put('/stocks/:id', auth, c.update)
  fastify.delete('/stocks/:id', auth, c.remove)

  fastify.get('/stocks/:id/transactions', auth, c.listTransactions)
  fastify.post('/stocks/:id/transactions', auth, c.addTransaction)
  fastify.delete('/stocks/:id/transactions/:txId', auth, c.deleteTransaction)
}
