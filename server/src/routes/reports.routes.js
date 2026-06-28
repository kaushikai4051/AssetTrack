const c = require('../controllers/reports.controller')

module.exports = async function reportsRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }
  fastify.get('/net-worth', auth, c.netWorthSnapshot)
  fastify.get('/interest-income', auth, c.interestIncome)
  fastify.get('/insurance', auth, c.insuranceSummary)
  fastify.get('/loans', auth, c.loanStatement)
}
