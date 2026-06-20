const dashboardController = require('../controllers/dashboard.controller')

module.exports = async function dashboardRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  fastify.get('/summary', auth, dashboardController.summary)
  fastify.get('/net-worth-history', auth, dashboardController.netWorthHistory)
  fastify.get('/upcoming-events', auth, dashboardController.upcomingEvents)
  fastify.get('/top-holdings', auth, dashboardController.topHoldings)
  fastify.get('/allocation', auth, dashboardController.allocation)
}
