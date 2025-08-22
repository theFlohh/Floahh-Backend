const DailyScore = require("../models/DailyScore");
const Artist = require("../models/Artist");
const WeeklyBonus = require("../models/WeeklyBonus");
const User = require("../models/User");
const FriendLeaderboard = require("../models/friendLeaderboardModel");
const mongoose = require("mongoose");
const UserTeam = require("../models/UserTeam");
const TeamMember = require("../models/TeamMember");

// exports.getDailyLeaderboard = async (req, res) => {
//   const dateQuery = req.query.date;
//   const targetDate = dateQuery
//     ? new Date(dateQuery)
//     : new Date().toISOString().slice(0, 10);

//   try {
//     const scores = await DailyScore.find({ date: targetDate }).populate("artistId");

//     const formatted = scores.map((entry) => ({
//       name: entry.artistId.name,
//       spotify: entry.breakdown.spotify || 0,
//       youtube: entry.breakdown.youtube || 0,
//       bonus: entry.breakdown.bonus || 0,
//       totalScore: entry.totalScore,
//     }));

//     const sorted = formatted.sort((a, b) => b.totalScore - a.totalScore);

//     res.json(sorted);
//   } catch (err) {
//     console.error("Leaderboard error:", err.message);
//     res.status(500).json({ error: "Failed to fetch leaderboard" });
//   }
// };

exports.getDailyLeaderboard = async (req, res) => {
  const dateQuery = req.query.date;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const minScore = parseInt(req.query.minScore) || 0;

  const targetDate = dateQuery
    ? new Date(dateQuery)
    : new Date().toISOString().slice(0, 10);

  try {
    const scores = await DailyScore.find({
      date: targetDate,
      totalScore: { $gte: minScore },
    })
      .populate("artistId")
      .sort({ totalScore: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const formatted = scores.map((entry) => ({
      name: entry.artistId.name,
      spotify: entry.breakdown.spotify || 0,
      youtube: entry.breakdown.youtube || 0,
      bonus: entry.breakdown.bonus || 0,
      totalScore: entry.totalScore,
      engagementRate: entry.engagementRate,
      spotifyStreams: entry.spotifyStreams,
      youtubeViews: entry.youtubeViews,
    }));

    res.json({
      page,
      limit,
      count: formatted.length,
      data: formatted,
    });
  } catch (err) {
    console.error("Leaderboard error:", err.message);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
};

exports.getWeeklyLeaderboard = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    now.setHours(23, 59, 59, 999);

    const weeklyData = await DailyScore.aggregate([
      {
        $match: {
          date: { $gte: sevenDaysAgo, $lte: now },
        },
      },
      {
        $group: {
          _id: "$artistId",
          totalScore: { $sum: "$totalScore" },
          spotify: { $sum: "$breakdown.spotify" },
          youtube: { $sum: "$breakdown.youtube" },
          bonus: { $sum: "$breakdown.bonus" },
          engagementRate: { $sum: "$engagementRate" },
          spotifyStreams: { $sum: "$spotifyStreams" },
          youtubeViews: { $sum: "$youtubeViews" },
        },
      },
      {
        $lookup: {
          from: "artists",
          localField: "_id",
          foreignField: "_id",
          as: "artist",
        },
      },
      { $unwind: "$artist" },
      {
        $project: {
          name: "$artist.name",
          totalScore: 1,
          spotify: 1,
          youtube: 1,
          bonus: 1,
          engagementRate: 1,
          spotifyStreams: 1,
          youtubeViews: 1,
        },
      },
      { $sort: { totalScore: -1 } },
    ]);

    res.json(weeklyData);
  } catch (err) {
    console.error("Weekly leaderboard error:", err);
    res.status(500).json({ error: "Failed to fetch weekly leaderboard" });
  }
};

exports.getMonthlyLeaderboard = async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 29);

  try {
    const monthlyData = await DailyScore.aggregate([
      {
        $match: {
          date: { $gte: thirtyDaysAgo, $lte: now },
        },
      },
      {
        $group: {
          _id: "$artistId",
          totalScore: { $sum: "$totalScore" },
          spotify: { $sum: "$breakdown.spotify" },
          youtube: { $sum: "$breakdown.youtube" },
          bonus: { $sum: "$breakdown.bonus" },
          engagementRate: { $sum: "$engagementRate" },
          spotifyStreams: { $sum: "$spotifyStreams" },
          youtubeViews: { $sum: "$youtubeViews" },
        },
      },
      {
        $lookup: {
          from: "artists",
          localField: "_id",
          foreignField: "_id",
          as: "artist",
        },
      },
      {
        $unwind: "$artist",
      },
      {
        $project: {
          name: "$artist.name",
          totalScore: 1,
          spotify: 1,
          youtube: 1,
          bonus: 1,
          engagementRate: 1,
          spotifyStreams: 1,
          youtubeViews: 1,
        },
      },
      {
        $sort: { totalScore: -1 },
      },
    ]);

    res.json(monthlyData);
  } catch (err) {
    console.error("Monthly leaderboard error:", err.message);
    res.status(500).json({ error: "Failed to fetch monthly leaderboard" });
  }
};

// exports.getTrendingArtists = async (req, res) => {
//   const getUTCDate = (daysOffset = 0) => {
//     const date = new Date();
//     date.setUTCDate(date.getUTCDate() + daysOffset);
//     date.setUTCHours(0, 0, 0, 0);
//     return date;
//   };

//   const today = getUTCDate(0);
//   const tomorrow = getUTCDate(1);

//   try {
//     // Get scores for today
//     const todayScores = await DailyScore.find({
//       date: { $gte: today, $lt: tomorrow },
//     }).populate("artistId");

//     if (!todayScores.length) return res.json([]);

//     // Find the most recent available date before today
//     const latestPrevious = await DailyScore.findOne({
//       date: { $lt: today },
//     })
//       .sort({ date: -1 })
//       .lean();

//     if (!latestPrevious) return res.json([]); // No past data

//     const previousDate = latestPrevious.date;
//     const previousScores = await DailyScore.find({ date: previousDate });

//     const previousMap = {};
//     for (const score of previousScores) {
//       previousMap[score.artistId.toString()] = score.totalScore;
//     }

//     const trending = todayScores.map((entry) => {
//       const yesterdayScore = previousMap[entry.artistId._id.toString()] || 0;
//       return {
//         name: entry.artistId.name,
//         artistId: entry.artistId._id,
//         today: entry.totalScore,
//         yesterday: yesterdayScore,
//         delta: entry.totalScore - yesterdayScore,
//       };
//     });

//     const sorted = trending
//       .filter((a) => a.delta > 0)
//       .sort((a, b) => b.delta - a.delta)
//       .slice(0, 10);

//     res.json(sorted);
//   } catch (err) {
//     console.error("Trending leaderboard error:", err.message);
//     res.status(500).json({ error: "Failed to fetch trending leaderboard" });
//   }
// };

exports.getTrendingArtists = async (req, res) => {
  const getUTCDate = (daysOffset = 0) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysOffset);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  };

  const today = getUTCDate(0);
  const tomorrow = getUTCDate(1);

  try {
    // Get scores for today
    const todayScores = await DailyScore.find({
      date: { $gte: today, $lt: tomorrow },
    }).populate("artistId");

    if (!todayScores.length) return res.json([]);

    // Find the most recent available date before today
    const latestPrevious = await DailyScore.findOne({
      date: { $lt: today },
    })
      .sort({ date: -1 })
      .lean();

    if (!latestPrevious) return res.json([]); // No past data

    const previousDate = latestPrevious.date;
    const previousScores = await DailyScore.find({ date: previousDate });

    const previousMap = {};
    for (const score of previousScores) {
      previousMap[score.artistId.toString()] = score.totalScore;
    }

    const trending = todayScores
      .filter((entry) => entry.artistId != null) // Filter out entries with null artistId
      .map((entry) => {
        const yesterdayScore = previousMap[entry.artistId._id.toString()] || 0;
        return {
          name: entry.artistId.name,
          artistId: entry.artistId._id,
          today: entry.totalScore,
          yesterday: yesterdayScore,
          delta: entry.totalScore - yesterdayScore,
        };
      });

    const sorted = trending
      .filter((a) => a.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 10);

    res.json(sorted);
  } catch (err) {
    console.error("Trending leaderboard error:", err.message);
    res.status(500).json({ error: "Failed to fetch trending leaderboard" });
  }
};

exports.getWeeklyBonuses = async (req, res) => {
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(now.getDate() - 7);

  try {
    const scores = await DailyScore.aggregate([
      {
        $match: {
          date: { $gte: weekAgo, $lte: now },
        },
      },
      {
        $group: {
          _id: "$artistId",
          weeklyTotal: { $sum: "$totalScore" },
          firstDay: { $min: "$date" },
          lastDay: { $max: "$date" },
        },
      },
      { $sort: { weeklyTotal: -1 } },
    ]);

    if (!scores.length) return res.json([]);

    const topScorer = scores[0];

    const improvements = await Promise.all(
      scores.map(async (s) => {
        const day1 = await DailyScore.findOne({
          artistId: s._id,
          date: s.firstDay,
        });
        const dayLast = await DailyScore.findOne({
          artistId: s._id,
          date: s.lastDay,
        });
        return {
          artistId: s._id,
          gain: (dayLast?.totalScore || 0) - (day1?.totalScore || 0),
        };
      })
    );

    const mostImproved = improvements.sort((a, b) => b.gain - a.gain)[0];

    // Define start of the current week
    const weekStart = new Date();
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    // Upsert bonus for top scorer
    await WeeklyBonus.findOneAndUpdate(
      { artistId: topScorer._id, type: "topScorer", weekStart },
      {
        artistId: topScorer._id,
        type: "topScorer",
        weekStart,
        bonusPoints: 100,
      },
      { upsert: true, new: true }
    );

    // Upsert bonus for most improved
    await WeeklyBonus.findOneAndUpdate(
      { artistId: mostImproved.artistId, type: "mostImproved", weekStart },
      {
        artistId: mostImproved.artistId,
        type: "mostImproved",
        weekStart,
        bonusPoints: 50,
      },
      { upsert: true, new: true }
    );

    const [topArtist, improvedArtist] = await Promise.all([
      Artist.findById(topScorer._id),
      Artist.findById(mostImproved.artistId),
    ]);

    res.json({
      topScorer: {
        name: topArtist.name,
        artistId: topArtist._id,
        weeklyTotal: topScorer.weeklyTotal,
        bonus: 100,
      },
      mostImproved: {
        name: improvedArtist.name,
        artistId: improvedArtist._id,
        gain: mostImproved.gain,
        bonus: 50,
      },
    });
  } catch (err) {
    console.error("Weekly bonus error:", err.message);
    res.status(500).json({ error: "Failed to compute weekly bonuses" });
  }
};

exports.getStoredBonuses = async (req, res) => {
  try {
    const bonuses = await WeeklyBonus.find()
      .populate("artistId")
      .sort({ weekStart: -1 });

    const formatted = bonuses.map((b) => ({
      artist: b.artistId.name,
      type: b.type,
      bonus: b.bonusPoints,
      weekStart: b.weekStart,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching stored bonuses:", err.message);
    res.status(500).json({ error: "Failed to fetch stored bonuses" });
  }
};

exports.getGlobalLeaderboard = async (req, res) => {
  try {
    const timeframe = req.query.timeframe || "all";
    const entity = req.query.entity || "users"; // 'users' | 'artists'

    let match = {};
    if (timeframe === "weekly") {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      match.createdAt = { $gte: weekAgo };
    } else if (timeframe === "monthly") {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      match.createdAt = { $gte: monthAgo };
    }

    // Conditionally fetch users
    let users = [];
    if (entity === "users") {
      users = await User.find(match)
        .sort({ totalPoints: -1 })
        .limit(100)
        .select("name totalPoints profileImage")
        .lean();
    }

    // Conditionally fetch artists using DailyScore aggregation to compute totalScore
    let artists = [];
    if (entity === "artists") {
      const now = new Date();
      let dateMatch = {};
      if (timeframe === "weekly") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        dateMatch = { date: { $gte: weekAgo, $lte: now } };
      } else if (timeframe === "monthly") {
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        dateMatch = { date: { $gte: monthAgo, $lte: now } };
      }

      const pipeline = [
        Object.keys(dateMatch).length ? { $match: dateMatch } : null,
        { $group: { _id: "$artistId", totalScore: { $sum: "$totalScore" } } },
        { $sort: { totalScore: -1 } },
        { $limit: 100 },
        {
          $lookup: {
            from: "artists",
            localField: "_id",
            foreignField: "_id",
            as: "artist",
          },
        },
        { $unwind: "$artist" },
        {
          $project: {
            _id: 1,
            totalScore: 1,
            name: "$artist.name",
            image: "$artist.image",
          },
        },
      ].filter(Boolean);

      artists = await DailyScore.aggregate(pipeline);
    }

    // Normalize shapes
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const usersFormatted = users.map((u) => ({
      id: u._id,
      name: u.name,
      totalPoints: u.totalPoints || 0,
      image: u.profileImage
        ? u.profileImage.startsWith("http")
          ? u.profileImage
          : `${baseUrl}${u.profileImage}`
        : null,
      type: "user",
    }));

    const artistsFormatted = artists.map((a) => ({
      id: a._id,
      name: a.name,
      totalScore: a.totalScore || 0,
      image: a.image || null,
      type: "artist",
    }));

    // Return only the requested entity
    if (entity === "users") {
      return res.status(200).json({ users: usersFormatted });
    }
    if (entity === "artists") {
      return res.status(200).json({ artists: artistsFormatted });
    }
    // Fallback
    return res
      .status(400)
      .json({ error: "Invalid entity. Use 'users' or 'artists'" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong." });
  }
};

exports.getFriendLeaderboardByParams = async (req, res) => {
  try {
    const { leaderboardId } = req.params;
    const board = await FriendLeaderboard.findById(leaderboardId).populate(
      "members",
      "username totalPoints"
    );

    if (!board) return res.status(404).json({ error: "Leaderboard not found" });

    const sorted = board.members.sort((a, b) => b.totalPoints - a.totalPoints);
    res.json({ name: board.name, leaderboard: sorted });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong." });
  }
};

// POST /api/leaderboard/friend
exports.createFriendLeaderboard = async (req, res) => {
  const { name, members } = req.body;
  const creatorId = req.user._id;

  try {
    const board = await FriendLeaderboard.create({
      name,
      creatorId,
      members: [...members, creatorId], // Add creator as member
    });
    res
      .status(201)
      .json({ message: "Friend leaderboard created", leaderboard: board });
  } catch (err) {
    console.error("Error creating friend leaderboard:", err);
    res.status(500).json({ error: "Failed to create leaderboard" });
  }
};

// GET /api/leaderboard/friend/:id
exports.getFriendLeaderboard = async (req, res) => {
  try {
    console.log("req is", req.params);

    const board = await FriendLeaderboard.findById(req.params.id).populate(
      "members",
      "name totalPoints"
    );

    if (!board) return res.status(404).json({ error: "Leaderboard not found" });

    const sorted = board.members.sort((a, b) => b.totalPoints - a.totalPoints);

    res.json({ name: board.name, leaderboard: sorted });
  } catch (err) {
    console.error("Error fetching friend leaderboard:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch leaderboard in get frinds api" });
  }
};

// GET /api/leaderboard/friend/mine
exports.getMyFriendLeaderboards = async (req, res) => {
  try {
    console.log("req is", req);

    const leaderboards = await FriendLeaderboard.find({
      creatorId: req.user._id,
    });
    console.log("leaderboards is", leaderboards);

    res.json({ leaderboards });
  } catch (err) {
    console.log("Error fetching your leaderboards:", err);

    res.status(500).json({ error: "Failed to fetch your leaderboards" });
  }
};

// POST /api/leaderboard/friend/:id/join
exports.joinFriendLeaderboard = async (req, res) => {
  const userId = req.user._id;
  const leaderboardId = req.params.id;

  try {
    const board = await FriendLeaderboard.findById(leaderboardId);
    if (!board) return res.status(404).json({ error: "Leaderboard not found" });

    if (!board.members.includes(userId)) {
      board.members.push(userId);
      await board.save();
    }

    res.json({ message: "Joined leaderboard successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to join leaderboard" });
  }
};

exports.checkDailyScoreDates = async (req, res) => {
  try {
    // Get the latest 10 dates from DailyScore collection
    const latestDates = await DailyScore.find({}, { date: 1 })
      .sort({ date: -1 })
      .limit(10)
      .lean();

    console.log("Latest 10 dates from DailyScore collection:");
    latestDates.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.date}`);
    });

    res.json({
      message: "Check console for latest dates",
      latestDates: latestDates.map((doc) => ({
        date: doc.date,
        dateString: doc.date.toISOString(),
        dateOnly: doc.date.toISOString().split("T")[0],
      })),
    });
  } catch (err) {
    console.error("Error checking DailyScore dates:", err.message);
    res.status(500).json({ error: "Failed to check dates" });
  }
};

