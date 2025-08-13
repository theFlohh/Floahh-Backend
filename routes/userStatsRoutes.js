const express = require("express");
const router = express.Router();
const { getUserStats, getUserStatsById, updateProfileImage } = require("../controllers/userStatsController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/", authMiddleware, getUserStats);
module.exports = router; 