const path = require('path')
const fs = require('fs')
const { importFD } = require('../controllers/imports/fd.import')
const { importPPF } = require('../controllers/imports/ppf.import')
const { importMutualFund } = require('../controllers/imports/mutualFund.import')

const TEMPLATES_DIR = path.join(__dirname, '../templates')

const TEMPLATE_FILES = {
  fd:            'fd_import_template.csv',
  ppf:           'ppf_import_template.csv',
  'mutual-fund': 'mutual_fund_import_template.csv',
}

module.exports = async function importsRoutes(fastify) {
  const auth = { preHandler: fastify.authenticate }

  // Download CSV template
  fastify.get('/templates/:type', auth, async (request, reply) => {
    const fileName = TEMPLATE_FILES[request.params.type]
    if (!fileName) return reply.code(404).send({ message: 'Unknown template type' })
    const filePath = path.join(TEMPLATES_DIR, fileName)
    if (!fs.existsSync(filePath)) return reply.code(404).send({ message: 'Template file not found' })
    return reply
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .header('Content-Type', 'text/csv')
      .send(fs.createReadStream(filePath))
  })

  // Import Fixed Deposits
  fastify.post('/fd', auth, importFD)

  // Import PPF
  fastify.post('/ppf', auth, importPPF)

  // Import Mutual Funds
  fastify.post('/mutual-fund', auth, importMutualFund)
}
