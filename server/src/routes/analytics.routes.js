const analyticsController = require('../controllers/analytics.controller')

module.exports = async function analyticsRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }
  fastify.get('/overview', auth, analyticsController.overview)
}
