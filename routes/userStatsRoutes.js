const express = require("express");
const router = express.Router();
const { getUserStats, getAppOverview, getUserStatsById, updateProfileImage } = require("../controllers/userStatsController");
const { authMiddleware } = require("../middleware/authMiddleware");
router.get("/", authMiddleware, getUserStats);
router.get("/overview", authMiddleware, getAppOverview);
module.exports = router; 