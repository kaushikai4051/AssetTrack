const c = require('../../controllers/assets/realEstate.controller')

module.exports = async function realEstateRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  fastify.get('/real-estate', auth, c.propertyList)
  fastify.post('/real-estate', auth, c.propertyCreate)
  fastify.get('/real-estate/:id', auth, c.propertyGet)
  fastify.put('/real-estate/:id', auth, c.propertyUpdate)
  fastify.delete('/real-estate/:id', auth, c.propertyDelete)
}
