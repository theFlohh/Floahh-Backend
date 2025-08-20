const UserTeam = require("../models/UserTeam");
const TeamMember = require("../models/TeamMember");
const Artist = require("../models/Artist");
const Tier = require("../models/Tier"); // Import the Tier model
const DailyScore = require("../models/DailyScore");
const User = require("../models/User");
const { determineCategory } = require("../utils/draftUtils");


exports.getDraftableArtists = async (req, res) => {
  const { category } = req.query;

  try {
    // 1️⃣ Fetch all tiers with artist populated
    const tiers = await Tier.find({ tier: category }).populate("artistId").lean();
    const artistIds = tiers.filter(t => t.artistId).map(t => t.artistId._id);

    // 2️⃣ Total distinct teams in this category
    const totalTeamsInCategory = await TeamMember.distinct("teamId", { category });
    const totalTeamsCount = totalTeamsInCategory.length;

    // 3️⃣ Draft pick counts per artist
    const pickCountsAgg = await TeamMember.aggregate([
      { $match: { category, artistId: { $in: artistIds } } },
      { $group: { _id: "$artistId", count: { $sum: 1 } } }
    ]);
    const pickCountMap = new Map(pickCountsAgg.map(doc => [doc._id.toString(), doc.count]));

    // 4️⃣ Fetch all scores for today and previous day in bulk
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const todayEnd = new Date(todayStart);
    todayEnd.setUTCHours(23, 59, 59, 999);

    // Scores for today
    const todayScores = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds }, date: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: "$artistId", score: { $sum: "$totalScore" } } }
    ]);

    // Scores for previous day
    const prevScores = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds }, date: { $lt: todayStart } } },
      { $sort: { date: -1 } },
      { $group: { _id: "$artistId", score: { $first: "$totalScore" } } }
    ]);

    // Total scores per artist
    const totalScoresAgg = await DailyScore.aggregate([
      { $match: { artistId: { $in: artistIds } } },
      { $group: { _id: "$artistId", totalScore: { $sum: "$totalScore" } } }
    ]);

    const totalScoreMap = new Map(totalScoresAgg.map(doc => [doc._id.toString(), doc.totalScore]));
    
    // 5️⃣ Compute ranking in Node.js
    const sortAndMapRanks = (scoreArray) => {
      const sorted = [...scoreArray].sort((a, b) => b.score - a.score);
      const rankMap = new Map();
      sorted.forEach((doc, idx) => rankMap.set(doc._id.toString(), idx + 1));
      return rankMap;
    };

    const todayRankMap = sortAndMapRanks(todayScores);
    const prevRankMap = sortAndMapRanks(prevScores);

    // 6️⃣ Build final response
    const artistsWithData = tiers.map(tier => {
      if (!tier.artistId) return null;
      const artistIdStr = tier.artistId._id.toString();

      const rank = todayRankMap.get(artistIdStr) || null;
      const previousRank = prevRankMap.get(artistIdStr) || null;
      const totalScore = totalScoreMap.get(artistIdStr) || 0;

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
        draftingPercentage
      };
    }).filter(a => a !== null);

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
    res.status(201).json({ message: "Draft submitted successfully", teamId: userTeam._id });
  } catch (err) {
    console.error("Error submitting draft:", err.message);
    res.status(500).json({ error: "Failed to submit draft" });
  }
};



// exports.getUserDraft = async (req, res) => {
//   const  userId  = req.user._id; // Assuming user is authenticated
//   console.log("user id is", req.user);
  
//   try {
//     // Find the user's team
//     const userTeam = await UserTeam.findOne({ userId });
//     console.log("user team is", userTeam);
    
    
//     if (!userTeam) {
//       return res.status(404).json({ error: "User  team not found" });
//     }

//     // Find team members associated with the user's team
//     const teamMembers = await TeamMember.find({ teamId: userTeam._id }).populate("artistId");
//     console.log("team members are", teamMembers);
    

//     // Return the user team along with its team members
//     res.json({ userTeam, teamMembers });
//   } catch (err) {
//     console.error("Error fetching user draft:", err.message);
//     res.status(500).json({ error: "Failed to fetch user draft" });
//   }
// };




exports.getUserDraft = async (req, res) => {
  if (!req.user?._id) {
    return res.status(401).json({ error: "Unauthorized: User not found in request" });
  }

  const userId = req.user._id;

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
      userProfileImage: userProfileImageUrl,
      teamTotalPoints: enriched.reduce((sum, m) => sum + (m.artistId?.totalScore || 0), 0),
      weeklyPoints: enriched.reduce((sum, m) => sum + (m.artistId?.weeklyPoints || 0), 0),
      teamRank,
      totalTeams: allTeams.length,
      userTeam,
      teamMembers: enriched
    });
  } catch (err) {
    console.error("Error fetching user draft:", err);
    res.status(500).json({ error: "Failed to fetch user draft" });
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

exports.updateDraft = async (req, res) => {
  const userId = req.user._id;
  let { draftedArtists, teamName, profileImage } = req.body;

  if (typeof draftedArtists === "string") {
    try {
      draftedArtists = JSON.parse(draftedArtists);
    } catch {
      draftedArtists = [];
    }
  }

  try {
    const userTeam = await UserTeam.findOne({ userId });
    if (!userTeam) return res.status(404).json({ error: "User team not found" });

    // Update team name (always allowed)
    if ("teamName" in req.body) {
      userTeam.teamName = teamName ?? null;
      await userTeam.save();
    }

    // Update profile image (always allowed)
    if (req.file?.filename) {
      await User.findByIdAndUpdate(userId, { profileImage: `/uploads/profile/${req.file.filename}` }, { new: true });
    } else if ("profileImage" in req.body) {
      await User.findByIdAndUpdate(userId, { profileImage: profileImage ?? null }, { new: true });
    }

    if (Array.isArray(draftedArtists) && draftedArtists.length > 0) {
      const existingMembers = await TeamMember.find({ teamId: userTeam._id }).select("artistId");
      const existingIds = new Set(existingMembers.map(m => String(m.artistId)));
      const incomingIds = new Set(draftedArtists.map(id => String(id)));
      const isSameSet = existingIds.size === incomingIds.size && Array.from(existingIds).every(id => incomingIds.has(id));

      if (!isSameSet) {
        const now = new Date();
        const referenceTime = userTeam.lastUpdatedAt ? new Date(userTeam.lastUpdatedAt) : new Date(userTeam.createdAt);

        // Calculate time since reference
        const msSinceRef = now - referenceTime;
        const cycleTime = 7 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000; // 7 days lock + 24 hours unlock
        const timeInCycle = msSinceRef % cycleTime;

        if (timeInCycle > 24 * 60 * 60 * 1000) {
          // Locked period (after 24h unlocked)
          const msRemaining = cycleTime - timeInCycle;
          const days = Math.floor(msRemaining / (24 * 60 * 60 * 1000));
          const hours = Math.floor((msRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const minutes = Math.floor((msRemaining % (60 * 60 * 1000)) / (60 * 1000));
          return res.status(403).json({
            error: "Draft is locked",
            message: `Team is locked. You can update in ${days}d ${hours}h ${minutes}m.`,
          });
        }

        // Unlock period, allow update
        await TeamMember.deleteMany({ teamId: userTeam._id });
        const teamMembers = await Promise.all(
          draftedArtists.map(async (artistId) => {
            const category = await determineCategory(artistId);
            return { teamId: userTeam._id, artistId, category };
          })
        );
        await TeamMember.insertMany(teamMembers);

        userTeam.lastUpdatedAt = now;
        await userTeam.save();

        return res.status(200).json({
          message: "Team members updated successfully. Team will lock after 24 hours.",
        });
      }
    }

    return res.status(200).json({ message: "Profile/Team info updated successfully" });

  } catch (err) {
    console.error("Error updating draft:", err.message);
    res.status(500).json({ error: "Failed to update draft" });
  }
};


