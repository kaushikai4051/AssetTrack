module.exports = function errorHandler(error, request, reply) {
  const statusCode = error.statusCode || 500

  // Don't leak internal errors in production
  const message =
    statusCode < 500
      ? error.message
      : process.env.NODE_ENV === 'development'
        ? error.message
        : 'Internal server error'

  reply.status(statusCode).send({
    error: error.name || 'Error',
    message,
    statusCode,
  })
}
