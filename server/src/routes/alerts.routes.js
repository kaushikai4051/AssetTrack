const alertsController = require('../controllers/alerts.controller')

module.exports = async function alertsRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }
  fastify.get('/all', auth, alertsController.all)
}
