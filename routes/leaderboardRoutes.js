const express = require("express");
const DailyScore = require('../models/DailyScore');
const User = require('../models/User');

const router = express.Router();
const {
  getDailyLeaderboard,
  getWeeklyLeaderboard,
  getMonthlyLeaderboard,
  getTrendingArtists,
  getWeeklyBonuses,
  getStoredBonuses,
  getGlobalLeaderboard,
  getFriendLeaderboard,
  getFriendLeaderboardByParams,
  createFriendLeaderboard,
  getMyFriendLeaderboards,
  joinFriendLeaderboard,
} = require("../controllers/leaderboardController");
const { authMiddleware } = require("../middleware/authMiddleware");

router.get("/", getDailyLeaderboard);
router.get("/weekly", getWeeklyLeaderboard);
router.get("/monthly", getMonthlyLeaderboard);
router.get("/trending", getTrendingArtists);
router.get("/weekly-bonuses", getWeeklyBonuses);
router.get("/weekly-bonuses/stored", getStoredBonuses);
router.get("/global-leaderboard", getGlobalLeaderboard);
router.post("/friend", authMiddleware, createFriendLeaderboard);
router.get("/friend/:id", authMiddleware, getFriendLeaderboard);
router.get("/mine/friend", authMiddleware, getMyFriendLeaderboards);
router.post("/friend/:id/join", authMiddleware, joinFriendLeaderboard);
router.get('/moves/users',authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24*60*60*1000);

    const current = await User.find({})
      .sort({ totalPoints: -1 })
      .select("name totalPoints profileImage")
      .lean();

    const previous = await User.find({})
      .sort({ totalPoints: -1 })
      .select("name totalPoints")
      .lean();

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    const final = current.map(user => {
      const prev = previous.find(p => p._id.toString() === user._id.toString());
      const prevScore = prev ? prev.totalPoints : 0;
      const currScore = user.totalPoints;

      const changeValue = currScore - prevScore;
      const changeDirection = changeValue > 0 ? "up" : changeValue < 0 ? "down" : "same";

      return {
        id: user._id,
        name: user.name,
        image: user.profileImage ? (user.profileImage.startsWith("http") ? user.profileImage : `${baseUrl}${user.profileImage}`) : null,
        currentScore: currScore,
        previousScore: prevScore,
        changeDirection,
        changeValue: Math.abs(changeValue),
        type: "user"
      };
    }).filter(item => item.changeDirection !== "same");

    return res.status(200).json(final);

  } catch (err) {
    console.error("ERROR IN USERS LEADERBOARD:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
});


router.get('/moves/artists',authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const yesterdayStart = new Date(now.getTime() - 48*60*60*1000);
    const yesterdayEnd = new Date(now.getTime() - 24*60*60*1000);

    const pipeline = (start, end) => [
      { $match: { date: { $gte: start, $lt: end } } },
      { $group: { _id: "$artistId", totalScore: { $sum: "$totalScore" } } },
      { $sort: { totalScore: -1 } },
      { $lookup: { from: "artists", localField: "_id", foreignField: "_id", as: "artist" } },
      { $unwind: "$artist" },
      { $project: { _id:1, totalScore:1, name:"$artist.name", image:"$artist.image" } }
    ];

    const current = await DailyScore.aggregate(pipeline(new Date(now.getTime() - 24*60*60*1000), now));
    const previous = await DailyScore.aggregate(pipeline(yesterdayStart, yesterdayEnd));

    const final = current.map(item => {
      const prev = previous.find(p => p._id.toString() === item._id.toString());
      const prevScore = prev ? prev.totalScore : 0;
      const currScore = item.totalScore;

      const changeValue = currScore - prevScore;
      const changeDirection = changeValue > 0 ? "up" : changeValue < 0 ? "down" : "same";

      return {
        id: item._id,
        name: item.name,
        image: item.image || null,
        currentScore: currScore,
        previousScore: prevScore,
        changeDirection,
        changeValue: Math.abs(changeValue),
        type: "artist"
      };
    }).filter(item => item.changeDirection !== "same"); // only up/down

    return res.status(200).json(final);

  } catch (err) {
    console.error("ERROR IN ARTISTS LEADERBOARD:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
});

module.exports = router;
