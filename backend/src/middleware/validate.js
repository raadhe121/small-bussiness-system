const { ApiError } = require("../utils/response");

const formatIssues = (zodError) =>
  zodError.issues.map((i) => ({ field: i.path.join(".") || "_", message: i.message }));

/**
 * Zod validation middleware.
 *
 * Preferred form: validate({ body, query, params }) — pass schemas for any
 * of the request parts; parsed values replace the originals and validated
 * query is exposed as req.validatedQuery (req.query is read-only in Express 5
 * but kept in sync here for Express 4 too).
 *
 * Also supports the single-part form validate(schema, source).
 */
function validate(schemas, source) {
  if (schemas && typeof schemas.safeParse === "function") {
    schemas = { [source || "body"]: schemas };
  }
  return (req, _res, next) => {
    const errors = [];
    try {
      if (schemas.body) {
        const r = schemas.body.safeParse(req.body);
        if (!r.success) errors.push(...formatIssues(r.error));
        else req.body = r.data;
      }
      if (schemas.query) {
        const r = schemas.query.safeParse(req.query);
        if (!r.success) errors.push(...formatIssues(r.error));
        else req.validatedQuery = r.data;
      }
      if (schemas.params) {
        const r = schemas.params.safeParse(req.params);
        if (!r.success) errors.push(...formatIssues(r.error));
        else req.validatedParams = r.data;
      }
    } catch (err) {
      return next(err);
    }
    if (errors.length) return next(new ApiError(422, "Validation failed", errors));
    next();
  };
}

module.exports = { validate };
