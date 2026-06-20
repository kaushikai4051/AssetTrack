const c = require('../../controllers/assets/bankAccounts.controller')

module.exports = async function bankAccountRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  // Fixed Deposits
  fastify.get('/fixed-deposits', auth, c.fdList)
  fastify.post('/fixed-deposits', auth, c.fdCreate)
  fastify.get('/fixed-deposits/:id', auth, c.fdGet)
  fastify.put('/fixed-deposits/:id', auth, c.fdUpdate)
  fastify.delete('/fixed-deposits/:id', auth, c.fdDelete)

  // Recurring Deposits
  fastify.get('/recurring-deposits', auth, c.rdList)
  fastify.post('/recurring-deposits', auth, c.rdCreate)
  fastify.get('/recurring-deposits/:id', auth, c.rdGet)
  fastify.put('/recurring-deposits/:id', auth, c.rdUpdate)
  fastify.delete('/recurring-deposits/:id', auth, c.rdDelete)

  // Savings Accounts
  fastify.get('/savings-accounts', auth, c.savingsList)
  fastify.post('/savings-accounts', auth, c.savingsCreate)
  fastify.get('/savings-accounts/:id', auth, c.savingsGet)
  fastify.put('/savings-accounts/:id', auth, c.savingsUpdate)
  fastify.delete('/savings-accounts/:id', auth, c.savingsDelete)
}
