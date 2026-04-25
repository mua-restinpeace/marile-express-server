const jwt = require("jsonwebtoken");

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

function generateAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function generateRefreshToken(payload) {
  const token = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
  return token;
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefreshTokeh(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

// convert duration like 7d or 15m to future date
function expiryDate(duration) {
  const unit  = duration.slice(-1);
  const value = parseInt(duration.slice(0, -1), 10);
  const ms    = unit === 'd' ? value * 86400000
              : unit === 'h' ? value * 3600000
              : unit === 'm' ? value * 60000
              : value * 1000;
  return new Date(Date.now() + ms);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshTokeh,
  expiryDate,
  REFRESH_EXPIRES,
};
