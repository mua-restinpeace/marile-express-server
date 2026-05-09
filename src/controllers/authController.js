const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { error, success } = require("../utils/response");
const {
  generateAccessToken,
  generateRefreshToken,
  REFRESH_EXPIRES,
  verifyRefreshTokeh,
  expiryDate,
} = require("../utils/jwt");

const REFRESH_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const ACCESS_COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 15 * 60 * 1000,
};

/**
 * POST /api/auth/login
 * create refresh & access token
 * body: { username, password}
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return error(res, "Username and password requried", 404);

    const user = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });
    if (!user || !user.is_active) return error(res, "User not found", 401);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return error(res, "Invalid credentials", 401);

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expired_at: expiryDate(REFRESH_EXPIRES),
      },
    });

    res.cookie("access_token", accessToken, ACCESS_COOKIE);
    res.cookie("refresh_token", refreshToken, REFRESH_COOKIE);

    return success(
      res,
      {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        },
        accessToken: accessToken,
      },
      "Login successful",
    );
  } catch (err) {
    console.log("Login error: ", err);
    return error(res, "Login failed", 500);
  }
}

/**
 * POST /api/auth/refresh
 * refresh access token life
 * cookie: refresh_token
 */
async function refreshToken(req, res) {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) return error(res, "Refresh token required", 401);

    let decode;
    try {
      decode = verifyRefreshTokeh(token);
    } catch {
      return error(res, "Invalid or Expired token", 401);
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored) {
      return error(res, "Refresh token has been revoked", 401);
    } else if (stored.expired_at < new Date()) {
      return error(res, "Refresh token has been expired", 401);
    }

    const user = await prisma.user.findUnique({ where: { id: decode.id } });
    if (!user) {
      return error(res, "User not found", 404);
    } else if (!user.is_active) {
      return error(res, "Invactive user", 401);
    }

    // delete token and issue a new one
    await prisma.refreshToken.delete({ where: { token } });

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expired_at: expiryDate(REFRESH_EXPIRES),
      },
    });

    res.cookie("access_token", newAccessToken, ACCESS_COOKIE);
    res.cookie("refresh_token", newRefreshToken, REFRESH_COOKIE);

    return success(res, { access_token: newAccessToken }, "Token refreshed");
  } catch (err) {
    console.log("Refresh token error: ", err);
    return error(res, "Refresh token failed", 500);
  }
}

/**
 * POST /api/auth/logout
 * clear access & refresh token from cookie
 * cookie: refresh_token
 * body: { refresh_token }
 */
async function logout(req, res) {
  try {
    const token = req.cookies?.refresh_token || req.body?.refresh_token;
    if (token) await prisma.refreshToken.deleteMany({ where: { token } });

    res.clearCookie("access_token");
    res.clearCookie("refresh_token");

    return success(res, null, "Logout successfully");
  } catch (err) {
    console.log("Logout error: ", err);
    return error(res, "Logout failed", 500);
  }
}

/**
 * GET /api/auth/me
 * return active user info
 */
async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        created_at: true,
      },
    });
    if (!user) return error(res, "User not found", 404);
    return success(res, { user });
  } catch (err) {
    return error(res, "Failed to fetch user info", 500);
  }
}

module.exports = { login, refreshToken, logout, getMe };
