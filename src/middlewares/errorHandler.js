// Central place where every error becomes a consistent JSON response.
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

// 404 for any route that didn't match
function notFound(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Errors we threw on purpose (validation, not found, conflict...)
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details && { errors: err.details }),
    });
  }

  // Client sent broken JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON in request body' });
  }

  // Client sent a body bigger than the allowed limit
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large' });
  }

  // Anything else is a bug or an infrastructure problem: log it, hide the details
  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(config.nodeEnv === 'development' && { debug: err.message || err.code }),
  });
}

module.exports = { notFound, errorHandler };
