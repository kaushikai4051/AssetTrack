const ctrl = require('../controllers/nominees.controller')

module.exports = async function nomineesRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  fastify.get('/summary', auth, ctrl.summary)
  fastify.get('/',        auth, ctrl.list)
  fastify.post('/',       auth, ctrl.create)
  fastify.put('/:id',     auth, ctrl.update)
  fastify.delete('/:id',  auth, ctrl.remove)
}
