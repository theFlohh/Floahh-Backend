const UserTeam = require("../models/UserTeam");
const TeamMember = require("../models/TeamMember");
const Artist = require("../models/Artist");
const Tier = require("../models/Tier"); // Import the Tier model
const DailyScore = require("../models/DailyScore");
const User = require("../models/User");
const { determineCategory } = require("../utils/draftUtils");
const mongoose = require("mongoose");
function normalizeIds(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((id) =>
      mongoose.Types.ObjectId.isValid(id)
        ? new mongoose.Types.ObjectId(id)
        : null
    )
    .filter(Boolean);
}
exports.updateDraft = async (req, res) => {
  console.log("function called");
  const userId = req.user._id;
  let { draftedArtists, teamName, profileImage } = req.body;

  // draftedArtists agar string ho to parse karo
  if (typeof draftedArtists === "string") {
    try {
      draftedArtists = JSON.parse(draftedArtists);
      console.log("Parsed draftedArtists:", draftedArtists);
    } catch {
      draftedArtists = [];
    }
  }

  try {
    const userTeam = await UserTeam.findOne({ userId });
    if (!userTeam) {
      return res.status(404).json({ error: "User team not found" });
    }

    // 1) Team name update
    if ("teamName" in req.body) {
      if (teamName === undefined || teamName === "undefined") {
        userTeam.teamName = null;
      } else {
        userTeam.teamName = teamName;
      }
      await userTeam.save();
    }

    // 2) Profile image update (S3 URL use karo)
    if (req.file?.s3Url) {
      await User.findByIdAndUpdate(
        userId,
        { profileImage: req.file.s3Url }, // 👈 local path ki jagah S3 URL
        { new: true }
      );
    } else if ("profileImage" in req.body) {
      await User.findByIdAndUpdate(
        userId,
        { profileImage: profileImage ?? null },
        { new: true }
      );
    }

    // 3) Drafted artists update
    const artistIds = normalizeIds(draftedArtists);
    console.log(
      "Normalized artistIds:",
      artistIds.map((x) => x.toString())
    );

        if (Array.isArray(draftedArtists) && draftedArtists.length > 0) {
      const now = new Date();

      // ✅ Sunday unlock logic 
      const isSunday = now.getDay() === 0; // getDay() => 0 = Sunday, 1 = Monday ... 6 = Saturday

      if (!isSunday) {
        return res.status(403).json({
          error: "Draft is locked",
          message: "Draft updates are only allowed on Sundays. Please try again next Sunday.",
        });
      }

      // sab purane members delete karo
      await TeamMember.deleteMany({ teamId: userTeam._id });

      // Tier batch resolve
      const tiers = await Tier.find({ artistId: { $in: artistIds } }).lean();
      const tierMap = new Map();
      tiers.forEach((t) => tierMap.set(String(t.artistId), t.tier));
      console.log("TierMap:", tierMap);

      // naye members banao
      const teamMembers = artistIds.map((id) => ({
        teamId: userTeam._id,
        artistId: id,
        category: tierMap.get(String(id)) || "Standard",
      }));

      // insert
      await TeamMember.insertMany(teamMembers);

      // team ka last update time save karo
      userTeam.lastUpdatedAt = now;
      await userTeam.save();

      return res.status(200).json({
        message:
          "Team members updated successfully. Draft will be locked until next Sunday.",
        count: teamMembers.length,
      });
    }


    return res
      .status(200)
      .json({ message: "Profile/Team info updated successfully" });
  } catch (err) {
    console.error("Error updating draft:", err);
    res.status(500).json({ error: "Failed to update draft" });
  }
};

exports.getDraftableArtists = async (req, res) => {
  const { category } = req.query;

  try {
    // 1️⃣ Fetch tiers with artist populated
    const tiers = await Tier.find({ tier: category })
      .populate("artistId")
      .lean();

    const artistIds = tiers
      .filter((t) => t.artistId)
      .map((t) => t.artistId._id);

    // 2️⃣ Distinct teams count
    const totalTeamsInCategory = await TeamMember.distinct("teamId", { category });
    const totalTeamsCount = totalTeamsInCategory.length;

    // 3️⃣ Draft pick counts per artist
    const pickCountsAgg = await TeamMember.aggregate([
      { $match: { category, artistId: { $in: artistIds } } },
      { $group: { _id: "$artistId", count: { $sum: 1 } } },
    ]);
    const pickCountMap = new Map(
      pickCountsAgg.map((doc) => [doc._id.toString(), doc.count])
    );

    // 4️⃣ Dates
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCHours(23, 59, 59, 999);

    // 5️⃣ Fetch today scores directly
    const todayScores = await DailyScore.find({
      artistId: { $in: artistIds },
      date: { $gte: todayStart, $lte: todayEnd },
    }).select("artistId totalScore");

    // 6️⃣ Fetch previous day last score
    const prevScores = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds }, date: { $lt: todayStart } } },
      { $sort: { date: -1 } },
      { $group: { _id: "$artistId", score: { $first: "$totalScore" } } },
    ]);

    // Maps
    const todayMap = new Map(todayScores.map((s) => [s.artistId.toString(), s.totalScore]));
    const prevMap = new Map(prevScores.map((s) => [s._id.toString(), s.score]));

    // 7️⃣ Ranking helpers
    const sortAndMapRanks = (scoreArray) => {
      const sorted = [...scoreArray].sort((a, b) => b.score - a.score);
      const rankMap = new Map();
      sorted.forEach((doc, idx) => rankMap.set(doc._id.toString(), idx + 1));
      return rankMap;
    };

    const todayRankMap = sortAndMapRanks(
      todayScores.map((s) => ({ _id: s.artistId, score: s.totalScore }))
    );
    const prevRankMap = sortAndMapRanks(prevScores);

    // 8️⃣ Final response
    const artistsWithData = tiers
      .map((tier) => {
        if (!tier.artistId) return null;
        const artistIdStr = tier.artistId._id.toString();

        const rank = todayRankMap.get(artistIdStr) || null;
        const previousRank = prevRankMap.get(artistIdStr) || null;
        const totalScore = todayMap.get(artistIdStr) || 0;

        const artistPickCount = pickCountMap.get(artistIdStr) || 0;
        const draftingPercentage = totalTeamsCount
          ? Math.round((artistPickCount / totalTeamsCount) * 100)
          : 0;

        const outOf = todayScores.length;

        return {
          ...tier.artistId,
          totalScore,
          rank,
          previousRank,
          outOf,
          draftingPercentage,
        };
      })
      .filter((a) => a !== null);

    res.json(artistsWithData);
  } catch (err) {
    console.error("Error fetching draftable artists:", err);
    res.status(500).json({ error: "Failed to fetch draftable artists" });
  }
};


// exports.submitDraft = async (req, res) => {
//   const { draftedArtists } = req.body; // draftedArtists should be an array of artist IDs
//   const userId = req.user._id;
//   console.log("user Id is", userId);

//   try {
//     const userTeam = await UserTeam.create({ userId });
//     console.log("userTeam is", userTeam);

//     // Use Promise.all to await all category determinations
//     const teamMembers = await Promise.all(
//       draftedArtists.map(async (artistId) => {
//         const category = await determineCategory(artistId); // Await the category determination
//         return {
//           teamId: userTeam._id,
//           artistId,
//           category,
//         };
//       })
//     );

//     await TeamMember.insertMany(teamMembers);
//     res.status(201).json({ message: "Draft submitted successfully", teamId: userTeam._id });
//   } catch (err) {
//     console.error("Error submitting draft:", err.message);
//     res.status(500).json({ error: "Failed to submit draft" });
//   }
// };

exports.submitDraft = async (req, res) => {
  const { draftedArtists, teamName } = req.body; // teamName is optional
  const userId = req.user._id;
  console.log("User  ID is", userId);

  try {
    // Create the user team with optional teamName
    const userTeam = await UserTeam.create({ userId, teamName });
    console.log("User  Team created:", userTeam);

    // Use Promise.all to await all category determinations
    const teamMembers = await Promise.all(
      draftedArtists.map(async (artistId) => {
        const category = await determineCategory(artistId); // Await the category determination
        return {
          teamId: userTeam._id, // Link to the created user team
          artistId,
          category,
        };
      })
    );

    // Insert team members and get their IDs
    const insertedMembers = await TeamMember.insertMany(teamMembers);
    console.log("Inserted Team Members:", insertedMembers);

    // No need to update userTeam with teamMembers since we are using teamId in TeamMember
    res
      .status(201)
      .json({ message: "Draft submitted successfully", teamId: userTeam._id });
  } catch (err) {
    console.error("Error submitting draft:", err.message);
    res.status(500).json({ error: "Failed to submit draft" });
  }
};


exports.getUserDraft = async (req, res) => {
  if (!req.user?._id) {
    return res
      .status(401)
      .json({ error: "Unauthorized: User not found in request" });
  }

  const userId = req.user._id;

  try {
    // 1️⃣ Fetch user and their draft team
    const [user, userTeam] = await Promise.all([
      User.findById(userId)
        .select("name profileImage totalPoints createdAt")
        .lean(),
      UserTeam.findOne({ userId }).lean(),
    ]);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!userTeam)
      return res.status(404).json({ error: "User team not found" });

    // 2️⃣ Fetch all team members in one query
    const teamMembers = await TeamMember.find({ teamId: userTeam._id })
      .populate("artistId")
      .lean();

    const artistIds = teamMembers.map((m) => m.artistId?._id).filter(Boolean);

    // 3️⃣ User Leaderboard (same as before)
    const timeframe = req.query.timeframe || "all"; // daily, weekly, monthly, all
    let match = {};

    if (timeframe === "weekly") {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      match.createdAt = { $gte: weekAgo };
    } else if (timeframe === "monthly") {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      match.createdAt = { $gte: monthAgo };
    }

    const users = await User.find(match)
      .sort({ totalPoints: -1 })
      .select("name totalPoints profileImage createdAt")
      .lean();

    const sortedUsers = users.map((u, idx) => {
      let weeklyPoints = 0;

      if (timeframe === "weekly") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (u.createdAt >= weekAgo) weeklyPoints = u.totalPoints;
      } else if (timeframe === "monthly") {
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        if (u.createdAt >= monthAgo) weeklyPoints = u.totalPoints;
      } else {
        weeklyPoints = u.totalPoints;
      }

      return {
        id: u._id.toString(),
        name: u.name,
        totalPoints: u.totalPoints || 0,
        weeklyPoints,
        image: u.profileImage || null,
        rank: idx + 1,
      };
    });

    const userLeaderboardEntry = sortedUsers.find(
      (u) => u.id === userId.toString()
    );

    const totalPoints = userLeaderboardEntry
      ? userLeaderboardEntry.totalPoints
      : 0;
    const weeklyPoints = userLeaderboardEntry
      ? userLeaderboardEntry.weeklyPoints
      : 0;
    const userRank = userLeaderboardEntry ? userLeaderboardEntry.rank : null;

    // -------------------------
    // 4️⃣ Artist Leaderboard — DAILY ranks (fixed)
    // -------------------------
    // Use today's UTC window and yesterday's window for ranking
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() - 1);

    // Aggregate top scores for today and yesterday (global, all artists)
    const [topScoresToday, topScoresYesterday] = await Promise.all([
      DailyScore.aggregate([
        { $match: { date: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: "$artistId", totalScore: { $sum: "$totalScore" } } },
        { $sort: { totalScore: -1, _id: 1 } },
      ]),
      DailyScore.aggregate([
        { $match: { date: { $gte: yesterdayStart, $lte: yesterdayEnd } } },
        { $group: { _id: "$artistId", totalScore: { $sum: "$totalScore" } } },
        { $sort: { totalScore: -1, _id: 1 } },
      ]),
    ]);

    const currentRankMap = new Map();
    topScoresToday.forEach((a, idx) => {
      currentRankMap.set(a._id.toString(), {
        rank: idx + 1,
        totalScore: a.totalScore,
      });
    });

    const prevRankMap = new Map();
    topScoresYesterday.forEach((a, idx) => {
      prevRankMap.set(a._id.toString(), {
        rank: idx + 1,
        totalScore: a.totalScore,
      });
    });

    const outOfToday = topScoresToday.length;

    // 4.5️⃣ Aaj ka totalScore for user's team members (same as before)
    const todayScores = await DailyScore.find({
      artistId: { $in: artistIds },
      date: { $gte: todayStart, $lte: todayEnd },
    })
      .select("artistId totalScore")
      .lean();

    const todayScoreMap = new Map(
      todayScores.map((doc) => [doc.artistId.toString(), doc.totalScore || 0])
    );

    // 5️⃣ Drafting percentage calculation (UNCHANGED)
    const userCategories = [...new Set(teamMembers.map((m) => m.category))];

    const totalTeamsByCategoryAgg = await TeamMember.aggregate([
      { $match: { category: { $in: userCategories } } },
      { $group: { _id: "$category", teams: { $addToSet: "$teamId" } } },
    ]);
    const totalTeamsByCategory = new Map(
      totalTeamsByCategoryAgg.map((doc) => [doc._id, doc.teams.length])
    );

    const pickCountsAgg = await TeamMember.aggregate([
      { $match: { artistId: { $in: artistIds } } },
      {
        $group: {
          _id: { artistId: "$artistId", category: "$category" },
          count: { $sum: 1 },
        },
      },
    ]);
    const pickCountsMap = new Map(
      pickCountsAgg.map((doc) => [
        `${doc._id.artistId}|${doc._id.category}`,
        doc.count,
      ])
    );

    // 6️⃣ Enrich team members (daily ranks + today's totalScore)
    const enriched = teamMembers.map((member) => {
      const artistIdStr = member.artistId?._id?.toString();

      const draftingPercentage = artistIdStr
        ? Math.round(
            ((pickCountsMap.get(`${artistIdStr}|${member.category}`) || 0) /
              (totalTeamsByCategory.get(member.category) || 1)) *
              100
          )
        : 0;

      const currentRankData = artistIdStr
        ? currentRankMap.get(artistIdStr)
        : null;
      const prevRankData = artistIdStr ? prevRankMap.get(artistIdStr) : null;

      const currentRank = currentRankData ? currentRankData.rank : null;
      const previousRank = prevRankData ? prevRankData.rank : null;

      // Rank change: positive -> rank improved (lower number is better)
      const rankChange =
        currentRank && previousRank ? previousRank - currentRank : null;

      // ⬇️ today's score for the artist (0 if none)
      const totalScore = artistIdStr
        ? todayScoreMap.get(artistIdStr) || 0
        : 0;

      return {
        ...member,
        artistId: member.artistId
          ? {
              ...member.artistId,
              draftingPercentage,
              currentRank,
              previousRank,
              rankChange,
              totalScore, // today’s score
            }
          : {
              draftingPercentage: 0,
              currentRank: null,
              previousRank: null,
              rankChange: null,
              totalScore: 0,
            },
      };
    });

    // 7️⃣ Profile image URL
    const userProfileImageUrl = user.profileImage
      ? user.profileImage.startsWith("http")
        ? user.profileImage
        : `${req.protocol}://${req.get("host")}${user.profileImage}`
      : null;

    // 8️⃣ Final response (includes outOfToday)
    res.json({
      userName: user.name,
      userProfileImage: userProfileImageUrl,
      totalPoints,
      weeklyPoints,
      rank: userRank,
      totalUsers: sortedUsers.length,
      userTeam,
      teamMembers: enriched,
      outOfToday,
    });
  } catch (err) {
    console.error("Error fetching user draft:", err);
    res.status(500).json({ error: "Failed to fetch user draft" });
  }
};




exports.getUserTeamById = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // 1️⃣ Fetch user and their team
    const [user, userTeam] = await Promise.all([
      User.findById(userId).select("name profileImage").lean(),
      UserTeam.findOne({ userId }).lean(),
    ]);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!userTeam)
      return res.status(404).json({ error: "User team not found" });

    // 2️⃣ Fetch all team members in one query
    const teamMembers = await TeamMember.find({ teamId: userTeam._id })
      .populate("artistId")
      .lean();

    const artistIds = teamMembers.map((m) => m.artistId?._id).filter(Boolean);

    // 3️⃣ Fetch total draft counts per category & artist in bulk
    const userCategories = [...new Set(teamMembers.map((m) => m.category))];

    const totalTeamsByCategoryAgg = await TeamMember.aggregate([
      { $match: { category: { $in: userCategories } } },
      { $group: { _id: "$category", teams: { $addToSet: "$teamId" } } },
    ]);
    const totalTeamsByCategory = new Map(
      totalTeamsByCategoryAgg.map((doc) => [doc._id, doc.teams.length])
    );

    const pickCountsAgg = await TeamMember.aggregate([
      { $match: { artistId: { $in: artistIds } } },
      {
        $group: {
          _id: { artistId: "$artistId", category: "$category" },
          count: { $sum: 1 },
        },
      },
    ]);
    const pickCountsMap = new Map(
      pickCountsAgg.map((doc) => [
        `${doc._id.artistId}|${doc._id.category}`,
        doc.count,
      ])
    );

    // 4️⃣ Fetch all DailyScore data in bulk
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    const scoresAgg = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds } } },
      {
        $group: {
          _id: "$artistId",
          totalScore: { $sum: "$totalScore" },
          latestScore: { $last: "$totalScore" },
          latestDate: { $last: "$date" },
          weeklyScore: {
            $sum: { $cond: [{ $gte: ["$date", weekAgo] }, "$totalScore", 0] },
          },
        },
      },
    ]);

    const scoreMap = new Map(scoresAgg.map((doc) => [doc._id.toString(), doc]));

    // 5️⃣ Compute today and previous rankings in Node.js
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayScores = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds }, date: { $gte: todayStart } } },
      { $group: { _id: "$artistId", score: { $sum: "$totalScore" } } },
    ]);

    const prevScores = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds }, date: { $lt: todayStart } } },
      { $sort: { date: -1 } },
      { $group: { _id: "$artistId", score: { $first: "$totalScore" } } },
    ]);

    const rankMap = (arr) => {
      const sorted = [...arr].sort((a, b) => b.score - a.score);
      const map = new Map();
      sorted.forEach((doc, idx) => map.set(doc._id.toString(), idx + 1));
      return map;
    };

    const todayRankMap = rankMap(todayScores);
    const prevRankMap = rankMap(prevScores);

    // 6️⃣ Enrich team members
    const enriched = teamMembers.map((member) => {
      const artistIdStr = member.artistId?._id?.toString();
      const scoreData = artistIdStr ? scoreMap.get(artistIdStr) : null;

      const totalScore = scoreData?.totalScore || 0;
      const weeklyPoints = scoreData?.weeklyScore || 0;
      const rank = artistIdStr ? todayRankMap.get(artistIdStr) || null : null;
      const previousRank = artistIdStr
        ? prevRankMap.get(artistIdStr) || null
        : null;
      const outOf = todayScores.length;

      const draftingPercentage = artistIdStr
        ? Math.round(
            ((pickCountsMap.get(`${artistIdStr}|${member.category}`) || 0) /
              (totalTeamsByCategory.get(member.category) || 1)) *
              100
          )
        : 0;

      return {
        ...member,
        artistId: member.artistId
          ? {
              ...member.artistId,
              totalScore,
              rank,
              previousRank,
              outOf,
              draftingPercentage,
              weeklyPoints,
            }
          : {
              totalScore: 0,
              rank: null,
              previousRank: null,
              outOf: 0,
              draftingPercentage: 0,
              weeklyPoints: 0,
            },
      };
    });

    // 7️⃣ Compute team total points & global ranking in bulk
    const allTeams = await UserTeam.find().lean();
    const allTeamMembers = await TeamMember.find({
      teamId: { $in: allTeams.map((t) => t._id) },
    }).lean();
    const artistToScoreMap = new Map(
      scoresAgg.map((doc) => [doc._id.toString(), doc.totalScore])
    );

    const teamPointsList = allTeams.map((team) => {
      const members = allTeamMembers.filter(
        (m) => m.teamId.toString() === team._id.toString()
      );
      const totalPoints = members.reduce((sum, m) => {
        const score = m.artistId
          ? artistToScoreMap.get(m.artistId.toString()) || 0
          : 0;
        return sum + score;
      }, 0);
      return { teamId: team._id.toString(), totalPoints };
    });

    teamPointsList.sort((a, b) => b.totalPoints - a.totalPoints);
    const teamRank =
      teamPointsList.findIndex((t) => t.teamId === userTeam._id.toString()) + 1;

    // 8️⃣ Profile image URL
    const userProfileImageUrl = user.profileImage
      ? user.profileImage.startsWith("http")
        ? user.profileImage
        : `${req.protocol}://${req.get("host")}${user.profileImage}`
      : null;

    res.json({
      teamName: userTeam.teamName,
      userName: user.name,
      userProfileImage: userProfileImageUrl,
      teamTotalPoints: enriched.reduce(
        (sum, m) => sum + (m.artistId?.totalScore || 0),
        0
      ),
      weeklyPoints: enriched.reduce(
        (sum, m) => sum + (m.artistId?.weeklyPoints || 0),
        0
      ),
      dailyPoints: enriched.reduce(
        (sum, m) => sum + (m.artistId?.latestScore || 0),
        0
      ),
      teamRank,
      totalTeams: allTeams.length,
      userTeam,
      teamMembers: enriched,
    });
  } catch (err) {
    console.error("Error fetching user team:", err);
    res.status(500).json({ error: "Failed to fetch user team" });
  }
};

exports.getUserTeamById = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  try {
    // 1️⃣ Fetch user and their team
    const [user, userTeam] = await Promise.all([
      User.findById(userId).select("name profileImage").lean(),
      UserTeam.findOne({ userId }).lean()
    ]);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!userTeam) return res.status(404).json({ error: "User team not found" });

    // 2️⃣ Fetch all team members in one query
    const teamMembers = await TeamMember.find({ teamId: userTeam._id })
      .populate("artistId")
      .lean();

    const artistIds = teamMembers.map(m => m.artistId?._id).filter(Boolean);

    // 3️⃣ Fetch total draft counts per category & artist in bulk
    const userCategories = [...new Set(teamMembers.map(m => m.category))];

    const totalTeamsByCategoryAgg = await TeamMember.aggregate([
      { $match: { category: { $in: userCategories } } },
      { $group: { _id: "$category", teams: { $addToSet: "$teamId" } } }
    ]);
    const totalTeamsByCategory = new Map(
      totalTeamsByCategoryAgg.map(doc => [doc._id, doc.teams.length])
    );

    const pickCountsAgg = await TeamMember.aggregate([
      { $match: { artistId: { $in: artistIds } } },
      { $group: { _id: { artistId: "$artistId", category: "$category" }, count: { $sum: 1 } } }
    ]);
    const pickCountsMap = new Map(
      pickCountsAgg.map(doc => [`${doc._id.artistId}|${doc._id.category}`, doc.count])
    );

    // 4️⃣ Fetch all DailyScore data in bulk
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    const scoresAgg = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds } } },
      {
        $group: {
          _id: "$artistId",
          totalScore: { $sum: "$totalScore" },
          latestScore: { $last: "$totalScore" },
          latestDate: { $last: "$date" },
          weeklyScore: {
            $sum: { $cond: [{ $gte: ["$date", weekAgo] }, "$totalScore", 0] }
          }
        }
      }
    ]);

    const scoreMap = new Map(scoresAgg.map(doc => [doc._id.toString(), doc]));

    // 5️⃣ Compute today and previous rankings in Node.js
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayScores = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds }, date: { $gte: todayStart } } },
      { $group: { _id: "$artistId", score: { $sum: "$totalScore" } } }
    ]);

    const prevScores = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds }, date: { $lt: todayStart } } },
      { $sort: { date: -1 } },
      { $group: { _id: "$artistId", score: { $first: "$totalScore" } } }
    ]);

    const rankMap = (arr) => {
      const sorted = [...arr].sort((a, b) => b.score - a.score);
      const map = new Map();
      sorted.forEach((doc, idx) => map.set(doc._id.toString(), idx + 1));
      return map;
    };

    const todayRankMap = rankMap(todayScores);
    const prevRankMap = rankMap(prevScores);

    // 6️⃣ Enrich team members
    const enriched = teamMembers.map(member => {
      const artistIdStr = member.artistId?._id?.toString();
      const scoreData = artistIdStr ? scoreMap.get(artistIdStr) : null;

      const totalScore = scoreData?.totalScore || 0;
      const weeklyPoints = scoreData?.weeklyScore || 0;
      const rank = artistIdStr ? todayRankMap.get(artistIdStr) || null : null;
      const previousRank = artistIdStr ? prevRankMap.get(artistIdStr) || null : null;
      const outOf = todayScores.length;

      const draftingPercentage = artistIdStr
        ? Math.round(
            ((pickCountsMap.get(`${artistIdStr}|${member.category}`) || 0) /
              (totalTeamsByCategory.get(member.category) || 1)) *
              100
          )
        : 0;

      return {
        ...member,
        artistId: member.artistId
          ? { ...member.artistId, totalScore, rank, previousRank, outOf, draftingPercentage, weeklyPoints }
          : { totalScore: 0, rank: null, previousRank: null, outOf: 0, draftingPercentage: 0, weeklyPoints: 0 }
      };
    });

    // 7️⃣ Compute team total points & global ranking in bulk
    const allTeams = await UserTeam.find().lean();
    const allTeamMembers = await TeamMember.find({ teamId: { $in: allTeams.map(t => t._id) } }).lean();
    const artistToScoreMap = new Map(scoresAgg.map(doc => [doc._id.toString(), doc.totalScore]));

    const teamPointsList = allTeams.map(team => {
      const members = allTeamMembers.filter(m => m.teamId.toString() === team._id.toString());
      const totalPoints = members.reduce((sum, m) => {
        const score = m.artistId ? artistToScoreMap.get(m.artistId.toString()) || 0 : 0;
        return sum + score;
      }, 0);
      return { teamId: team._id.toString(), totalPoints };
    });

    teamPointsList.sort((a, b) => b.totalPoints - a.totalPoints);
    const teamRank = teamPointsList.findIndex(t => t.teamId === userTeam._id.toString()) + 1;

    // 8️⃣ Profile image URL
    const userProfileImageUrl = user.profileImage
      ? user.profileImage.startsWith("http")
        ? user.profileImage
        : `${req.protocol}://${req.get("host")}${user.profileImage}`
      : null;

    res.json({
      teamName: userTeam.teamName,
      userName: user.name,
      userProfileImage: userProfileImageUrl,
      teamTotalPoints: enriched.reduce((sum, m) => sum + (m.artistId?.totalScore || 0), 0),
      weeklyPoints: enriched.reduce((sum, m) => sum + (m.artistId?.weeklyPoints || 0), 0),
      dailyPoints: enriched.reduce((sum, m) => sum + (m.artistId?.latestScore || 0), 0),
      teamRank,
      totalTeams: allTeams.length,
      userTeam,
      teamMembers: enriched
    });
  } catch (err) {
    console.error("Error fetching user team:", err);
    res.status(500).json({ error: "Failed to fetch user team" });
  }
};


exports.lockDraft = async (req, res) => {
  const userId = req.user._id; // Assuming user is authenticated
  try {
    const userTeam = await UserTeam.findOneAndUpdate(
      { userId },
      { isLocked: true },
      { new: true }
    );
    res.json({ message: "Draft locked successfully", team: userTeam });
  } catch (err) {
    console.error("Error locking draft:", err.message);
    res.status(500).json({ error: "Failed to lock draft" });
  }
};
