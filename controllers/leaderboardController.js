const DailyScore = require("../models/DailyScore");
const Artist = require("../models/Artist");
const WeeklyBonus = require("../models/WeeklyBonus");

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
      youtubeViews: entry.youtubeViews
      
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
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 6);

  try {
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
          engagementRate: {$sum: "$engagementRate"},
          spotifyStreams: {$sum: "$spotifyStreams"},
          youtubeViews: {$sum: "$youtubeViews" }
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

    res.json(weeklyData);
  } catch (err) {
    console.error("Weekly leaderboard error:", err.message);
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
      .filter(entry => entry.artistId != null) // Filter out entries with null artistId
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
    const bonuses = await WeeklyBonus.find().populate("artistId").sort({ weekStart: -1 });

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


