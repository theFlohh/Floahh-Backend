const express = require("express");
const router = express.Router();
const { getDailyLeaderboard, getWeeklyLeaderboard, getMonthlyLeaderboard, getTrendingArtists, getWeeklyBonuses, getStoredBonuses } = require("../controllers/leaderboardController");

router.get("/", getDailyLeaderboard);
router.get("/weekly", getWeeklyLeaderboard);
router.get("/monthly", getMonthlyLeaderboard);
router.get("/trending", getTrendingArtists);
router.get("/weekly-bonuses", getWeeklyBonuses);
router.get("/weekly-bonuses/stored", getStoredBonuses);

module.exports = router;
