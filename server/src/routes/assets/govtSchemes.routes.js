const c = require('../../controllers/assets/govtSchemes.controller')

module.exports = async function govtSchemesRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  fastify.get('/govt-schemes',                           auth, c.list)
  fastify.post('/govt-schemes',                          auth, c.create)
  fastify.get('/govt-schemes/:id',                       auth, c.get)
  fastify.put('/govt-schemes/:id',                       auth, c.update)
  fastify.delete('/govt-schemes/:id',                    auth, c.remove)

  fastify.get('/govt-schemes/:id/transactions',          auth, c.listTransactions)
  fastify.post('/govt-schemes/:id/transactions',         auth, c.addTransaction)
  fastify.delete('/govt-schemes/:id/transactions/:txId', auth, c.deleteTransaction)
}
