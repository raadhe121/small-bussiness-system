const { ApiError } = require("../utils/response");

/**
 * Build an Express handler that bulk-deletes rows by id.
 *
 * Rows are deleted one-by-one (not via deleteMany) so a foreign-key
 * restriction on a single row fails that row individually instead of
 * rolling back the whole batch. The response reports partial success:
 *   { deleted: number, failed: [{ id, reason }] }
 *
 * @param {object} opts
 * @param {object} opts.delegate   Prisma model delegate, e.g. prisma.product
 * @param {object|function} [opts.scope]  extra `where` clause for tenant
 *                                       scoping — object or function(req)
 */
function bulkDeleteHandler({ delegate, scope }) {
  return async (req, res, next) => {
    try {
      const ids = req.body?.ids;
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new ApiError(400, "Provide a non-empty `ids` array");
      }
      if (!ids.every((id) => typeof id === "string" && id.length > 0)) {
        throw new ApiError(400, "All ids must be strings");
      }
      if (ids.length > 500) {
        throw new ApiError(400, "Too many ids in one request (max 500)");
      }

      const extra = typeof scope === "function" ? scope(req) : scope || {};
      let deleted = 0;
      const failed = [];

      for (const id of ids) {
        try {
          await delegate.delete({ where: { id, ...extra } });
          deleted += 1;
        } catch (err) {
          let reason = "Could not delete";
          if (err.code === "P2025") reason = "Not found or already deleted";
          else if (err.code === "P2003") reason = "Referenced by other records";
          else if (err.message) reason = err.message;
          failed.push({ id, reason });
        }
      }

      res.json({
        success: true,
        message: `Deleted ${deleted} of ${ids.length}`,
        data: { deleted, failed },
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { bulkDeleteHandler };
