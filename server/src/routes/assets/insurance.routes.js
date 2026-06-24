const c = require('../../controllers/assets/insurance.controller')

module.exports = async function insuranceRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  fastify.get('/insurance', auth, c.policyList)
  fastify.post('/insurance', auth, c.policyCreate)
  fastify.get('/insurance/:id', auth, c.policyGet)
  fastify.put('/insurance/:id', auth, c.policyUpdate)
  fastify.delete('/insurance/:id', auth, c.policyDelete)

  fastify.get('/insurance/:id/nominees', auth, c.nomineeList)
  fastify.post('/insurance/:id/nominees', auth, c.nomineeCreate)
  fastify.delete('/insurance/:id/nominees/:nomineeId', auth, c.nomineeDelete)

  fastify.get('/insurance/:id/premium-payments', auth, c.premiumList)
  fastify.post('/insurance/:id/premium-payments', auth, c.premiumCreate)
}
