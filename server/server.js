require('dotenv').config()
const app = require('./src/app')

const start = async () => {
  try {
    const port = parseInt(process.env.PORT) || 4000
    const host = process.env.HOST || '0.0.0.0'
    await app.listen({ port, host })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
