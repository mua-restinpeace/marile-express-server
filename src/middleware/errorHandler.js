const { error } = require("../utils/response");

function errorHandler(err, req, res, next) {
  console.log("Unhandled error: ", err);

  if (err.type === "entity.parse.failed")
    return error(res, "Invalid JSON in request body", 400);

  // prisma unique constraint violation
  if (err.code === "P2002")
    return error(res, `${err.meta?.target} already exists`, 400);

  // prisma record not found
  if (err.code === "P2025") return error(res, "Record not found", 404);

  // default
  return error(res, err.message || "Internal server error", err.status || 500);
}

function notFound(req, res) {
  return error(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
}

module.exports = { errorHandler, notFound };
