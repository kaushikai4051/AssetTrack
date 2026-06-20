const authController = require('../controllers/auth.controller')

module.exports = async function authRoutes(fastify) {
  fastify.post('/register', authController.register)
  fastify.post('/login', authController.login)
  fastify.post('/logout', authController.logout)
  fastify.post('/refresh', authController.refresh)
  fastify.get('/me', { preHandler: fastify.authenticate }, authController.me)
}
