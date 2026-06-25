const c = require('../controllers/goals.controller')
const { query } = require('../models/db')

module.exports = async function goalRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  // Flat list of all active assets — used by link-assets modal
  fastify.get('/assets', auth, async (request) => {
    const rows = await query(
      request.server.db,
      `SELECT id, asset_type, asset_name, current_value
       FROM assets WHERE user_id = ? AND is_active = 1
       ORDER BY asset_name`,
      [request.user.id]
    )
    return rows.map((r) => ({ ...r, current_value: parseFloat(r.current_value) }))
  })

  fastify.get('/goals',          auth, c.goalList)
  fastify.post('/goals',         auth, c.goalCreate)
  fastify.get('/goals/:id',      auth, c.goalGet)
  fastify.put('/goals/:id',      auth, c.goalUpdate)
  fastify.delete('/goals/:id',   auth, c.goalDelete)

  fastify.post('/goals/:id/assets',                auth, c.goalLinkAsset)
  fastify.delete('/goals/:id/assets/:assetId',     auth, c.goalUnlinkAsset)
  fastify.get('/goals/:id/projection',             auth, c.goalProjection)
}
