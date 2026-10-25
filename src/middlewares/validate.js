// Validates req.body / req.query / req.params against a Zod schema.
// Clean, converted data is stored on req.validated[source] for the controller.
const ApiError = require('../utils/ApiError');

const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source] ?? {});

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || source, // whole-object errors are reported as "body"/"query"
      message: issue.message,
    }));
    return next(ApiError.badRequest('Validation failed', details));
  }

  req.validated = { ...req.validated, [source]: result.data };
  next();
};

module.exports = validate;
