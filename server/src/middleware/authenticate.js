async function authenticate(request, reply) {
  try {
    await request.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token', statusCode: 401 })
  }
}

module.exports = authenticate
