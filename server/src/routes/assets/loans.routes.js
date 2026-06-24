const c = require('../../controllers/assets/loans.controller')

module.exports = async function loanRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  fastify.get('/loans', auth, c.loanList)
  fastify.post('/loans', auth, c.loanCreate)
  fastify.get('/loans/:id', auth, c.loanGet)
  fastify.put('/loans/:id', auth, c.loanUpdate)
  fastify.delete('/loans/:id', auth, c.loanDelete)

  fastify.get('/loans/:id/amortization', auth, c.loanAmortization)
  fastify.get('/loans/:id/prepayment-simulator', auth, c.prepaymentSimulator)

  fastify.get('/loans/:id/transactions', auth, c.txnList)
  fastify.post('/loans/:id/transactions', auth, c.txnCreate)
}
