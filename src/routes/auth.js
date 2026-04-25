const express = require("express");
const {
  login,
  refreshToken,
  logout,
  getMe,
} = require("../controllers/authController");
const { authentication, authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

// protected routes
router.get("/me", authenticate, getMe);

module.exports = router;
