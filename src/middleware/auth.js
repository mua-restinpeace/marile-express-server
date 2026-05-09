const { error } = require("../utils/response");
const { verifyAccessToken } = require("../utils/jwt");

// verify jwt token from authorize header or cookies
function authenticate(req, res, next) {
  try {
    let token = null;

    const authHeader = req.headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) token = authHeader.slice(7);
    if (!token && req.cookies?.access_token) token = req.cookies.access_token;

    if (!token) return error(res, "Access token is required", 401);

    const decode = verifyAccessToken(token);
    req.user = {
      id: decode.id,
      username: decode.username,
      role: decode.role,
      name: decode.name,
    };
    console.log("user authenticate");
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError")
      return error(res, "Access token has expired", 401);

    if (err.name === "JsonWebTokenError")
      return error(res, "Invalid access token", 401);

    return error(res, "Authentication failed", 401);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return error(res, "Not authenticated", 401);
    if (!roles.includes(req.user.role))
      return error(
        res,
        `Access denied. Required role(s): ${roles.join(", ")}`,
        403,
      );
    next();
  };
}

module.exports = { authenticate, authorize };