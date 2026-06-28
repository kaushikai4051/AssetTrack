const c = require('../controllers/documents.controller')

module.exports = async function documentsRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }
  fastify.post('/', auth, c.upload)
  fastify.get('/', auth, c.list)
  fastify.get('/:id/download', auth, c.download)
  fastify.delete('/:id', auth, c.remove)
}
