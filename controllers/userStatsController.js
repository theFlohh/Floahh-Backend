const User = require("../models/User");
const UserTeam = require("../models/UserTeam");
const FriendLeaderboard = require("../models/friendLeaderboardModel");
const DailyScore = require("../models/DailyScore");
const Artist = require("../models/Artist");
const TeamMember = require("../models/TeamMember");
const Tier = require("../models/Tier");
const mongoose = require("mongoose");

exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user basic info
    const user = await User.findById(userId).select("name totalPoints profileImage");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Compute user's team total points via aggregation (aligned with getUserPointsBreakdown)
    let teamTotalPoints = 0;
    let teamName = null;
    const teamAgg = await UserTeam.aggregate([
      { $match: { userId: mongoose.Types.ObjectId.createFromHexString(String(userId)) } },
      { $lookup: { from: "teammembers", localField: "_id", foreignField: "teamId", as: "members" } },
      { $project: { teamName: 1, artistIds: "$members.artistId" } },
      { $lookup: {
          from: "dailyscores",
          let: { artistIds: "$artistIds" },
          pipeline: [
            { $match: { $expr: { $in: ["$artistId", "$$artistIds"] } } },
            { $group: { _id: null, totalPoints: { $sum: "$totalScore" } } }
          ],
          as: "scoreAgg"
        }
      },
      { $project: { teamName: 1, totalPoints: { $ifNull: [ { $arrayElemAt: ["$scoreAgg.totalPoints", 0] }, 0 ] } } }
    ]);
    if (teamAgg[0]) {
      teamTotalPoints = teamAgg[0].totalPoints || 0;
      teamName = teamAgg[0].teamName || null;
    }

    // Resolve the user's team id for ranking comparisons
    const myTeamDoc = await UserTeam.findOne({ userId }).select("_id");
    const myTeamId = myTeamDoc?._id || null;

    // Global ranking: count how many users' drafted totals exceed current user's drafted total using a single aggregation
    let globalRanking = 1;
    const globalAgg = await UserTeam.aggregate([
      { $lookup: { from: "teammembers", localField: "_id", foreignField: "teamId", as: "members" } },
      { $project: { userId: 1, artistIds: "$members.artistId" } },
      { $lookup: {
          from: "dailyscores",
          let: { artistIds: "$artistIds" },
          pipeline: [
            { $match: { $expr: { $in: ["$artistId", "$$artistIds"] } } },
            { $group: { _id: null, totalPoints: { $sum: "$totalScore" } } }
          ],
          as: "scoreAgg"
        }
      },
      { $project: { userId: 1, totalPoints: { $ifNull: [ { $arrayElemAt: ["$scoreAgg.totalPoints", 0] }, 0 ] } } },
      { $match: { totalPoints: { $gt: teamTotalPoints } } },
      { $count: "better" }
    ]);
    const betterUsers = globalAgg[0]?.better || 0;
    globalRanking = betterUsers + 1;

    // Weekly team ranking movement (numeric)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Helper to compute per-team totals within a time window
    async function computeTeamTotalsWithin(startDate, endDate) {
      const list = await UserTeam.aggregate([
        { $lookup: { from: "teammembers", localField: "_id", foreignField: "teamId", as: "members" } },
        { $project: { teamId: "$_id", artistIds: "$members.artistId" } },
        { $lookup: {
            from: "dailyscores",
            let: { artistIds: "$artistIds" },
            pipeline: [
              { $match: { $expr: { $in: ["$artistId", "$$artistIds"] }, date: { $gte: startDate, $lt: endDate } } },
              { $group: { _id: null, total: { $sum: "$totalScore" } } }
            ],
            as: "scoreAgg"
          } 
        },
        { $project: { teamId: 1, totalPoints: { $ifNull: [ { $arrayElemAt: ["$scoreAgg.total", 0] }, 0 ] } } }
      ]);
      return list;
    }

    const currentWeekList = await computeTeamTotalsWithin(weekAgo, now);
    const previousWeekList = await computeTeamTotalsWithin(twoWeeksAgo, weekAgo);

    const sortedCurrent = currentWeekList.sort((a, b) => b.totalPoints - a.totalPoints);
    const sortedPrevious = previousWeekList.sort((a, b) => b.totalPoints - a.totalPoints);

    const weeklyCurrentRank = myTeamId ? (sortedCurrent.findIndex(t => String(t.teamId) === String(myTeamId)) + 1 || null) : null;
    const weeklyPreviousRank = myTeamId ? (sortedPrevious.findIndex(t => String(t.teamId) === String(myTeamId)) + 1 || null) : null;
    const weeklyRankChange = (weeklyCurrentRank && weeklyPreviousRank)
      ? (weeklyPreviousRank - weeklyCurrentRank)
      : null;

    // Friends ranking: aggregate each friend's drafted total in one pipeline and compute current user's position
    let friendsRanking = null;
    const friendBoardAgg = await FriendLeaderboard.aggregate([
      { $match: { members: mongoose.Types.ObjectId.createFromHexString(String(userId)) } },
      { $limit: 1 },
      { $project: { members: 1 } },
      { $unwind: "$members" },
      { $lookup: { from: "userteams", localField: "members", foreignField: "userId", as: "team" } },
      { $unwind: { path: "$team", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "teammembers", localField: "team._id", foreignField: "teamId", as: "tm" } },
      { $project: { memberId: "$members", artistIds: "$tm.artistId" } },
      { $lookup: {
          from: "dailyscores",
          let: { artistIds: "$artistIds" },
          pipeline: [
            { $match: { $expr: { $in: ["$artistId", "$$artistIds"] } } },
            { $group: { _id: null, total: { $sum: "$totalScore" } } }
          ],
          as: "scoreAgg"
        }
      },
      { $project: { memberId: 1, points: { $ifNull: [ { $arrayElemAt: ["$scoreAgg.total", 0] }, 0 ] } } },
      { $group: { _id: null, members: { $push: { id: "$memberId", points: "$points" } } } }
    ]);
    if (friendBoardAgg[0]?.members?.length) {
      const sorted = friendBoardAgg[0].members.sort((a, b) => b.points - a.points);
      friendsRanking = sorted.findIndex(m => String(m.id) === String(userId)) + 1 || null;
    }

    // Removed old categorical weekly status; replaced with numeric weekly movement above

    // Get total number of users for percentage calculations
    const totalUsers = await User.countDocuments();
    const globalRankPercentage = totalUsers > 0 ? ((totalUsers - globalRanking + 1) / totalUsers * 100).toFixed(1) : 0;

    // Prepare response
    const profileImageUrl = user.profileImage
      ? (user.profileImage.startsWith("http")
        ? user.profileImage
        : `${req.protocol}://${req.get("host")}${user.profileImage}`)
      : null;
    const userStats = {
      username: user.name,
      profileImage: profileImageUrl,
      teamName: teamName || "No Team",
      teamTotalPoints: teamTotalPoints,
      globalRanking: globalRanking,
      globalRankPercentage: `${globalRankPercentage}%`,
      friendsRanking: friendsRanking || "No Friends Leaderboard",
      weeklyCurrentRank: weeklyCurrentRank,
      weeklyPreviousRank: weeklyPreviousRank,
      weeklyRankChange: weeklyRankChange
    };

    res.status(200).json({
      success: true,
      data: userStats
    });

  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch user statistics" 
    });
  }
};


// GET /api/user-stats/overview
// Returns: total users, new users this week, total artists, per-category artist counts,
// and drafting percentage for all artists (based on latest tier and category denominators)
exports.getAppOverview = async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Basic counts in parallel
    const [totalUsers, newUsersThisWeek, totalArtists] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      Artist.countDocuments()
    ]);

    // Latest tier per artist (category)
    const latestTiers = await Tier.aggregate([
      { $sort: { artistId: 1, evaluatedAt: -1 } },
      { $group: { _id: "$artistId", tier: { $first: "$tier" } } }
    ]);
    const artistIdToTier = new Map(latestTiers.map(t => [String(t._id), t.tier]));

    // Category counts from latest tiers
    const categoryCounts = latestTiers.reduce((acc, t) => {
      acc[t.tier] = (acc[t.tier] || 0) + 1;
      return acc;
    }, {});

    // Denominators: total distinct teams that drafted in each category
    const categories = ["Legend", "Trending", "Breakout", "Standard"];
    const denomEntries = await Promise.all(
      categories.map(async (cat) => {
        const count = (await TeamMember.distinct("teamId", { category: cat })).length;
        return [cat, count];
      })
    );
    const denomByCategory = new Map(denomEntries);

    // Numerators: pick counts by artist and category
    const pickCountsAgg = await TeamMember.aggregate([
      { $group: { _id: { artistId: "$artistId", category: "$category" }, count: { $sum: 1 } } }
    ]);
    const pickCountKeyed = new Map(
      pickCountsAgg.map(doc => [
        `${String(doc._id.artistId)}|${doc._id.category}`,
        doc.count
      ])
    );

    // Load minimal artist info for output
    const artists = await Artist.find().select("name image").lean();
    const artistIdToInfo = new Map(artists.map(a => [String(a._id), { name: a.name, image: a.image || null }]));

    // Total score per artist (all-time)
    const artistTotalsAgg = await DailyScore.aggregate([
      { $group: { _id: "$artistId", totalScore: { $sum: "$totalScore" } } }
    ]);
    const artistTotalScoreById = new Map(
      artistTotalsAgg.map(doc => [String(doc._id), doc.totalScore || 0])
    );

    const artistsDrafting = artists.map(a => {
      const idStr = String(a._id);
      const category = artistIdToTier.get(idStr) || null;
      const denominator = category ? (denomByCategory.get(category) || 0) : 0;
      const numerator = category ? (pickCountKeyed.get(`${idStr}|${category}`) || 0) : 0;
      const draftingPercentage = denominator > 0
        ? Math.round((numerator / denominator) * 100)
        : 0;
      const totalScore = artistTotalScoreById.get(idStr) || 0;
      return {
        id: a._id,
        name: a.name,
        image: a.image || null,
        category,
        draftingPercentage,
        totalScore
      };
    });

    // Top 10 artists by drafting percentage (dynamic)
    const topDraftedArtists = [...artistsDrafting]
      .sort((a, b) => b.draftingPercentage - a.draftingPercentage || (b.totalScore - a.totalScore))
      .slice(0, 10);

    // Top 10 users by login count (dynamic)
    const topUsers = await User.find()
      .sort({ loginCount: -1 })
      .limit(10)
      .select("name profileImage loginCount totalPoints createdAt")
      .lean();

    // Total teams
    const totalTeams = await UserTeam.countDocuments();

    // Top 5 teams by total drafted points (all-time)
    const topTeamsAgg = await UserTeam.aggregate([
      { $lookup: { from: "teammembers", localField: "_id", foreignField: "teamId", as: "members" } },
      { $project: { teamId: "$_id", teamName: 1, artistIds: "$members.artistId" } },
      { $lookup: {
          from: "dailyscores",
          let: { artistIds: "$artistIds" },
          pipeline: [
            { $match: { $expr: { $in: ["$artistId", "$$artistIds"] } } },
            { $group: { _id: null, total: { $sum: "$totalScore" } } }
          ],
          as: "scoreAgg"
        }
      },
      { $project: { teamId: 1, teamName: 1, totalPoints: { $ifNull: [ { $arrayElemAt: ["$scoreAgg.total", 0] }, 0 ] } } },
      { $sort: { totalPoints: -1 } },
      { $limit: 5 }
    ]);

    // Top 5 artists by all-time totalScore
    const topArtistsAgg = await DailyScore.aggregate([
      { $group: { _id: "$artistId", totalScore: { $sum: "$totalScore" } } },
      { $sort: { totalScore: -1, _id: 1 } },
      { $limit: 5 },
      { $lookup: { from: "artists", localField: "_id", foreignField: "_id", as: "artist" } },
      { $unwind: "$artist" },
      { $project: { _id: 0, artistId: "$_id", name: "$artist.name", image: "$artist.image", totalScore: 1 } }
    ]);

    // Trending up/down based on latest available day vs previous available day
    let topGainers = [];
    let topDecliners = [];
    // Top artists by daily (latest day), weekly and monthly
    let dailyTopArtists = [];
    let weeklyTopArtists = [];
    let monthlyTopArtists = [];
    // Rank movers
    let rankMoversUp = [];
    let rankMoversDown = [];
    const latestDoc = await DailyScore.findOne().sort({ date: -1 }).lean();
    if (latestDoc) {
      const currentStart = new Date(latestDoc.date);
      currentStart.setUTCHours(0, 0, 0, 0);
      const currentEnd = new Date(latestDoc.date);
      currentEnd.setUTCHours(23, 59, 59, 999);

      const prevDoc = await DailyScore.findOne({ date: { $lt: currentStart } }).sort({ date: -1 }).lean();
      if (prevDoc) {
        const prevStart = new Date(prevDoc.date);
        prevStart.setUTCHours(0, 0, 0, 0);
        const prevEnd = new Date(prevDoc.date);
        prevEnd.setUTCHours(23, 59, 59, 999);

        const [currentAgg, previousAgg] = await Promise.all([
          DailyScore.aggregate([
            { $match: { date: { $gte: currentStart, $lte: currentEnd } } },
            { $group: { _id: "$artistId", score: { $sum: "$totalScore" } } }
          ]),
          DailyScore.aggregate([
            { $match: { date: { $gte: prevStart, $lte: prevEnd } } },
            { $group: { _id: "$artistId", score: { $sum: "$totalScore" } } }
          ])
        ]);

        const currentMap = new Map(currentAgg.map(r => [String(r._id), r.score || 0]));
        const previousMap = new Map(previousAgg.map(r => [String(r._id), r.score || 0]));
        const unionIds = new Set([...currentMap.keys(), ...previousMap.keys()]);

        const deltas = Array.from(unionIds).map(idStr => {
          const today = currentMap.get(idStr) || 0;
          const yesterday = previousMap.get(idStr) || 0;
          return { artistId: idStr, today, yesterday, delta: today - yesterday };
        });

        const gainers = deltas.filter(d => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5);
        const decliners = deltas.filter(d => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5);

        topGainers = gainers.map(g => ({
          artistId: g.artistId,
          name: artistIdToInfo.get(g.artistId)?.name || null,
          image: artistIdToInfo.get(g.artistId)?.image || null,
          today: g.today,
          yesterday: g.yesterday,
          delta: g.delta
        }));

        topDecliners = decliners.map(d => ({
          artistId: d.artistId,
          name: artistIdToInfo.get(d.artistId)?.name || null,
          image: artistIdToInfo.get(d.artistId)?.image || null,
          today: d.today,
          yesterday: d.yesterday,
          delta: d.delta
        }));

        // Rank movers between prev and current day
        const currentRanked = [...currentAgg]
          .sort((a, b) => (b.score - a.score) || (String(a._id).localeCompare(String(b._id))))
          .map((r, idx) => ({ id: String(r._id), rank: idx + 1 }));
        const prevRanked = [...previousAgg]
          .sort((a, b) => (b.score - a.score) || (String(a._id).localeCompare(String(b._id))))
          .map((r, idx) => ({ id: String(r._id), rank: idx + 1 }));
        const currentRankMap = new Map(currentRanked.map(r => [r.id, r.rank]));
        const prevRankMap = new Map(prevRanked.map(r => [r.id, r.rank]));
        const rankUnion = new Set([...currentRankMap.keys(), ...prevRankMap.keys()]);
        const rankDeltas = Array.from(rankUnion).map(idStr => {
          const cur = currentRankMap.get(idStr) ?? null;
          const prev = prevRankMap.get(idStr) ?? null;
          // deltaRank = prev - cur (positive = moved up)
          const deltaRank = (prev && cur) ? (prev - cur) : 0;
          return { artistId: idStr, deltaRank, currentRank: cur, previousRank: prev };
        });
        rankMoversUp = rankDeltas
          .filter(r => r.deltaRank > 0)
          .sort((a, b) => b.deltaRank - a.deltaRank)
          .slice(0, 5)
          .map(r => ({
            artistId: r.artistId,
            name: artistIdToInfo.get(r.artistId)?.name || null,
            image: artistIdToInfo.get(r.artistId)?.image || null,
            previousRank: r.previousRank,
            currentRank: r.currentRank,
            deltaRank: r.deltaRank
          }));
        rankMoversDown = rankDeltas
          .filter(r => r.deltaRank < 0)
          .sort((a, b) => a.deltaRank - b.deltaRank)
          .slice(0, 5)
          .map(r => ({
            artistId: r.artistId,
            name: artistIdToInfo.get(r.artistId)?.name || null,
            image: artistIdToInfo.get(r.artistId)?.image || null,
            previousRank: r.previousRank,
            currentRank: r.currentRank,
            deltaRank: r.deltaRank
          }));

        // Daily top artists for the latest day
        dailyTopArtists = currentRanked
          .slice(0, 10)
          .map(r => ({
            artistId: r.id,
            name: artistIdToInfo.get(r.id)?.name || null,
            image: artistIdToInfo.get(r.id)?.image || null,
            rank: r.rank,
            score: currentMap.get(r.id) || 0
          }));
      }
    }

    // Weekly and monthly top artists
    const nowTs = new Date();
    const weekAgoTs = new Date(nowTs.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgoTs = new Date(nowTs.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [weeklyAggArtists, monthlyAggArtists] = await Promise.all([
      DailyScore.aggregate([
        { $match: { date: { $gte: weekAgoTs, $lte: nowTs } } },
        { $group: { _id: "$artistId", totalScore: { $sum: "$totalScore" } } },
        { $sort: { totalScore: -1, _id: 1 } },
        { $limit: 10 },
        { $lookup: { from: "artists", localField: "_id", foreignField: "_id", as: "artist" } },
        { $unwind: "$artist" },
        { $project: { artistId: "$_id", name: "$artist.name", image: "$artist.image", totalScore: 1, _id: 0 } }
      ]),
      DailyScore.aggregate([
        { $match: { date: { $gte: monthAgoTs, $lte: nowTs } } },
        { $group: { _id: "$artistId", totalScore: { $sum: "$totalScore" } } },
        { $sort: { totalScore: -1, _id: 1 } },
        { $limit: 10 },
        { $lookup: { from: "artists", localField: "_id", foreignField: "_id", as: "artist" } },
        { $unwind: "$artist" },
        { $project: { artistId: "$_id", name: "$artist.name", image: "$artist.image", totalScore: 1, _id: 0 } }
      ])
    ]);
    weeklyTopArtists = weeklyAggArtists;
    monthlyTopArtists = monthlyAggArtists;

    // Users leaderboard top 10 by totalPoints
    const usersLeaderboardTop = await User.find()
      .sort({ totalPoints: -1 })
      .limit(10)
      .select("name totalPoints profileImage")
      .lean();

    // Weekly and monthly top teams
    const [weeklyTopTeams, monthlyTopTeams] = await Promise.all([
      UserTeam.aggregate([
        { $lookup: { from: "teammembers", localField: "_id", foreignField: "teamId", as: "members" } },
        { $project: { teamId: "$_id", teamName: 1, artistIds: "$members.artistId" } },
        { $lookup: {
            from: "dailyscores",
            let: { artistIds: "$artistIds" },
            pipeline: [
              { $match: { $expr: { $in: ["$artistId", "$$artistIds"] }, date: { $gte: weekAgoTs, $lte: nowTs } } },
              { $group: { _id: null, total: { $sum: "$totalScore" } } }
            ],
            as: "scoreAgg"
          }
        },
        { $project: { teamId: 1, teamName: 1, totalPoints: { $ifNull: [ { $arrayElemAt: ["$scoreAgg.total", 0] }, 0 ] } } },
        { $sort: { totalPoints: -1 } },
        { $limit: 10 }
      ]),
      UserTeam.aggregate([
        { $lookup: { from: "teammembers", localField: "_id", foreignField: "teamId", as: "members" } },
        { $project: { teamId: "$_id", teamName: 1, artistIds: "$members.artistId" } },
        { $lookup: {
            from: "dailyscores",
            let: { artistIds: "$artistIds" },
            pipeline: [
              { $match: { $expr: { $in: ["$artistId", "$$artistIds"] }, date: { $gte: monthAgoTs, $lte: nowTs } } },
              { $group: { _id: null, total: { $sum: "$totalScore" } } }
            ],
            as: "scoreAgg"
          }
        },
        { $project: { teamId: 1, teamName: 1, totalPoints: { $ifNull: [ { $arrayElemAt: ["$scoreAgg.total", 0] }, 0 ] } } },
        { $sort: { totalPoints: -1 } },
        { $limit: 10 }
      ])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        newUsersThisWeek,
        totalArtists,
        categoryCounts,
        totalTeams,
        topTeams: topTeamsAgg,
        topArtists: topArtistsAgg,
        usersLeaderboardTop,
        dailyTopArtists,
        weeklyTopArtists,
        monthlyTopArtists,
        weeklyTopTeams,
        monthlyTopTeams,
        topGainers,
        topDecliners,
        rankMoversUp,
        rankMoversDown,
        artistsDrafting,
        topDraftedArtists,
        topUsers
      }
    });
  } catch (error) {
    console.error("Error fetching app overview:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch app overview" });
  }
};
