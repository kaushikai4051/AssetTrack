const c = require('../../controllers/assets/gold.controller')

module.exports = async function goldRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  fastify.get('/gold',        auth, c.list)
  fastify.post('/gold',       auth, c.create)
  fastify.get('/gold/:id',    auth, c.get)
  fastify.put('/gold/:id',    auth, c.update)
  fastify.delete('/gold/:id', auth, c.remove)
}
