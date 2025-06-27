const express = require("express");
const router = express.Router();
const { getDailyLeaderboard, getWeeklyLeaderboard, getMonthlyLeaderboard, getTrendingArtists, getWeeklyBonuses, getStoredBonuses, getGlobalLeaderboard, getFriendLeaderboard, getFriendLeaderboardByParams, createFriendLeaderboard, getMyFriendLeaderboards, joinFriendLeaderboard } = require("../controllers/leaderboardController");
const {authMiddleware} = require("../middleware/authMiddleware");

router.get("/", getDailyLeaderboard);
router.get("/weekly", getWeeklyLeaderboard);
router.get("/monthly", getMonthlyLeaderboard);
router.get("/trending", getTrendingArtists);
router.get("/weekly-bonuses", getWeeklyBonuses);
router.get("/weekly-bonuses/stored", getStoredBonuses);
router.get("/global", getGlobalLeaderboard);
// router.get("/friend/:leaderboardId", getFriendLeaderboardByParams);
router.post("/friend", authMiddleware, createFriendLeaderboard);
router.get("/friend/:id", authMiddleware, getFriendLeaderboard);
router.get("/mine/friend", authMiddleware, getMyFriendLeaderboards);
router.post("/friend/:id/join", authMiddleware, joinFriendLeaderboard);

module.exports = router;
