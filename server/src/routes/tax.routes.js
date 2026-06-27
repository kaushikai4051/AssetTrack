const { summary, capitalGains, deductions, harvesting } = require('../controllers/tax.controller')

module.exports = async function taxRoutes(fastify) {
  const auth = { preHandler: [fastify.authenticate] }

  fastify.get('/summary',              auth, summary)
  fastify.get('/capital-gains',        auth, capitalGains)
  fastify.get('/deductions',           auth, deductions)
  fastify.get('/harvesting-suggestions', auth, harvesting)
}
