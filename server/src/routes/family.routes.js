const c = require('../controllers/family.controller')

module.exports = async function familyRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }
  fastify.get('/', auth, c.list)
  fastify.post('/', auth, c.create)
  fastify.put('/:id', auth, c.update)
  fastify.delete('/:id', auth, c.remove)
}
