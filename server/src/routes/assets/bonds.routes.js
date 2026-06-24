const c = require('../../controllers/assets/bonds.controller')

module.exports = async function bondRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  fastify.get('/bonds', auth, c.bondList)
  fastify.post('/bonds', auth, c.bondCreate)
  fastify.get('/bonds/:id', auth, c.bondGet)
  fastify.put('/bonds/:id', auth, c.bondUpdate)
  fastify.delete('/bonds/:id', auth, c.bondDelete)

  fastify.get('/bonds/:id/coupon-schedule', auth, c.couponSchedule)
  fastify.get('/bonds/:id/coupon-payments', auth, c.couponList)
  fastify.post('/bonds/:id/coupon-payments', auth, c.couponCreate)
}
