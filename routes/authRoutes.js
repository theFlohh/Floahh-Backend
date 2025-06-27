const express = require("express");
const router = express.Router();
const { register, login, getUserPointsBreakdown, fetchAllUsers } = require("../controllers/authController");
const { authMiddleware, requireAdmin, requireUser } = require("../middleware/authMiddleware");
// Middleware imported and ready for use in other routes if needed
router.post("/register", register);
router.post("/login", login);
router.get("/user-points", authMiddleware, getUserPointsBreakdown);
router.get('/all-users', fetchAllUsers);

module.exports = router;
