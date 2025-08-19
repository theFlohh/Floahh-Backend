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
    const tiers = await Tier.find({ tier: category }).populate("artistId");

    // Pre-compute drafting counts and denominators for percentage by category
    const artistIdsInCategory = tiers
      .filter(t => t.artistId)
      .map(t => t.artistId._id);

    // Total distinct teams that have drafted in this category (denominator)
    const totalTeamsInCategory = (await TeamMember.distinct("teamId", { category })).length;

    // Draft pick counts per artist within the same category (numerator)
    const pickCountsAgg = await TeamMember.aggregate([
      { $match: { category, artistId: { $in: artistIdsInCategory } } },
      { $group: { _id: "$artistId", count: { $sum: 1 } } }
    ]);
    const pickCountByArtistId = new Map(
      pickCountsAgg.map(doc => [doc._id.toString(), doc.count])
    );

    const artistsWithData = await Promise.all(
      tiers.map(async (tier) => {
        if (!tier.artistId) return null;

        // Latest score record
        const latestScore = await DailyScore.findOne({ artistId: tier.artistId._id })
          .sort({ date: -1 })
          .lean();

        let rank = null;
        let previousRank = null;
        let outOf = 0;

        if (latestScore?.date) {
          /** ---------- TODAY's RANK ---------- **/
          const dayStart = new Date(latestScore.date);
          dayStart.setUTCHours(0, 0, 0, 0);

          const dayEnd = new Date(latestScore.date);
          dayEnd.setUTCHours(23, 59, 59, 999);

          const rankingList = await DailyScore.aggregate([
            { $match: { date: { $gte: dayStart, $lte: dayEnd } } },
            {
              $group: {
                _id: "$artistId",
                score: { $sum: "$totalScore" }
              }
            },
            { $sort: { score: -1, _id: 1 } }
          ]);

          outOf = rankingList.length;
          const rankIndex = rankingList.findIndex(
            r => r._id.toString() === tier.artistId._id.toString()
          );
          rank = rankIndex >= 0 ? rankIndex + 1 : null;

          /** ---------- PREVIOUS AVAILABLE RANK ---------- **/
          const previousScoreDoc = await DailyScore.findOne({
            artistId: tier.artistId._id,
            date: { $lt: dayStart }
          })
            .sort({ date: -1 })
            .lean();

          if (previousScoreDoc?.date) {
            const prevStart = new Date(previousScoreDoc.date);
            prevStart.setUTCHours(0, 0, 0, 0);

            const prevEnd = new Date(previousScoreDoc.date);
            prevEnd.setUTCHours(23, 59, 59, 999);

            const prevRankingList = await DailyScore.aggregate([
              { $match: { date: { $gte: prevStart, $lte: prevEnd } } },
              { $group: { _id: "$artistId", score: { $sum: "$totalScore" } } },
              { $sort: { score: -1, _id: 1 } }
            ]);

            if (prevRankingList.length > 0) {
              const prevRankIndex = prevRankingList.findIndex(
                r => r._id.toString() === tier.artistId._id.toString()
              );
              previousRank = prevRankIndex >= 0 ? prevRankIndex + 1 : null;
            }
          }
        }

        /** ---------- TOTAL SCORE ---------- **/
        const totalScoreAgg = await DailyScore.aggregate([
          { $match: { artistId: tier.artistId._id } },
          { $group: { _id: null, totalScore: { $sum: "$totalScore" } } },
        ]);
        const totalScore = totalScoreAgg[0]?.totalScore || 0;

        // ---------- DRAFTING PERCENTAGE (by category) ----------
        const artistPickCount = pickCountByArtistId.get(tier.artistId._id.toString()) || 0;
        const draftingPercentage = totalTeamsInCategory > 0
          ? Math.round((artistPickCount / totalTeamsInCategory) * 100)
          : 0;

        return {
          ...tier.artistId.toObject(),
          totalScore,
          rank,
          previousRank,
          outOf,
          draftingPercentage
        };
      })
    );

    res.json(artistsWithData.filter(a => a));
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
  const userId = req.user._id;

  try {
    const user = await User.findById(userId).select("name profileImage");
    if (!user) return res.status(404).json({ error: "User not found" });

    const userTeam = await UserTeam.findOne({ userId });
    if (!userTeam) return res.status(404).json({ error: "User team not found" });

    const teamMembers = await TeamMember.find({ teamId: userTeam._id }).populate("artistId");

    // Pre-compute drafting denominators and pick counts per category for the user's artists
    const userCategories = [...new Set(teamMembers.map(m => m.category))];
    const totalTeamsByCategoryEntries = await Promise.all(
      userCategories.map(async (cat) => {
        const count = (await TeamMember.distinct("teamId", { category: cat })).length;
        return [cat, count];
      })
    );
    const totalTeamsByCategory = new Map(totalTeamsByCategoryEntries);

    // For pick counts per artist (restricted to artists on the team and by their category)
    const artistIds = teamMembers.map(m => m.artistId?._id).filter(Boolean);
    const pickCountsAgg = await TeamMember.aggregate([
      { $match: { artistId: { $in: artistIds } } },
      { $group: { _id: { artistId: "$artistId", category: "$category" }, count: { $sum: 1 } } }
    ]);
    const pickCountsKeyed = new Map(
      pickCountsAgg.map(doc => [`${doc._id.artistId.toString()}|${doc._id.category}`, doc.count])
    );

    const enriched = await Promise.all(
      teamMembers.map(async (member) => {
        const scoreAgg = await DailyScore.aggregate([
          { $match: { artistId: member.artistId._id } },
          { $group: { _id: null, totalScore: { $sum: "$totalScore" } } },
        ]);
        const totalScore = scoreAgg[0]?.totalScore || 0;

        const latestScore = await DailyScore.findOne({ artistId: member.artistId._id })
          .sort({ date: -1 })
          .lean();

        let rank = null;
        let previousRank = null;
        let outOf = 0;

        if (latestScore?.date) {
          const dayStart = new Date(latestScore.date);
          dayStart.setUTCHours(0, 0, 0, 0);

          const dayEnd = new Date(latestScore.date);
          dayEnd.setUTCHours(23, 59, 59, 999);

          const rankingList = await DailyScore.aggregate([
            { $match: { date: { $gte: dayStart, $lte: dayEnd } } },
            { $group: { _id: "$artistId", score: { $sum: "$totalScore" } } },
            { $sort: { score: -1, _id: 1 } }
          ]);

          outOf = rankingList.length;
          const rankIndex = rankingList.findIndex(r => r._id.toString() === member.artistId._id.toString());
          rank = rankIndex >= 0 ? rankIndex + 1 : null;

          const previousScoreDoc = await DailyScore.findOne({
            artistId: member.artistId._id,
            date: { $lt: dayStart }
          })
            .sort({ date: -1 })
            .lean();

          if (previousScoreDoc?.date) {
            const prevStart = new Date(previousScoreDoc.date);
            prevStart.setUTCHours(0, 0, 0, 0);

            const prevEnd = new Date(previousScoreDoc.date);
            prevEnd.setUTCHours(23, 59, 59, 999);

            const prevRankingList = await DailyScore.aggregate([
              { $match: { date: { $gte: prevStart, $lte: prevEnd } } },
              { $group: { _id: "$artistId", score: { $sum: "$totalScore" } } },
              { $sort: { score: -1, _id: 1 } }
            ]);

            if (prevRankingList.length > 0) {
              const prevRankIndex = prevRankingList.findIndex(r => r._id.toString() === member.artistId._id.toString());
              previousRank = prevRankIndex >= 0 ? prevRankIndex + 1 : null;
            }
          }
        }

        return {
          ...member.toObject(),
          artistId: {
            ...member.artistId.toObject(),
            totalScore,
            rank,
            previousRank,
            outOf,
            draftingPercentage: (() => {
              const denominator = totalTeamsByCategory.get(member.category) || 0;
              const numerator = pickCountsKeyed.get(`${member.artistId._id.toString()}|${member.category}`) || 0;
              return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
            })()
          }
        };
      })
    );

    // Team total points
    const teamTotalPoints = enriched.reduce((sum, m) => sum + m.artistId.totalScore, 0);

    // Weekly points (keep only points, remove ranking)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyScores = await DailyScore.aggregate([
      { $match: { artistId: { $in: enriched.map(m => m.artistId._id) }, date: { $gte: weekAgo } } },
      { $group: { _id: null, weeklyPoints: { $sum: "$totalScore" } } }
    ]);
    const weeklyPoints = weeklyScores[0]?.weeklyPoints || 0;

    // Calculate team global ranking
    const allTeams = await UserTeam.find();
    const teamPointsList = await Promise.all(
      allTeams.map(async (team) => {
        const members = await TeamMember.find({ teamId: team._id });
        if (members.length === 0) return { teamId: team._id, totalPoints: 0 };

        const pointsAgg = await DailyScore.aggregate([
          { $match: { artistId: { $in: members.map(m => m.artistId) } } },
          { $group: { _id: null, totalPoints: { $sum: "$totalScore" } } }
        ]);
        return { teamId: team._id, totalPoints: pointsAgg[0]?.totalPoints || 0 };
      })
    );

    const sortedTeams = teamPointsList.sort((a, b) => b.totalPoints - a.totalPoints);
    const teamRank = sortedTeams.findIndex(team => team.teamId.toString() === userTeam._id.toString()) + 1;

    // Profile image URL
    const userProfileImageUrl = user.profileImage
      ? (user.profileImage.startsWith("http") ? user.profileImage : `${req.protocol}://${req.get("host")}${user.profileImage}`)
      : null;

    res.json({
      teamName: userTeam.teamName,
      userProfileImage: userProfileImageUrl,
      teamTotalPoints,
      weeklyPoints,
      teamRank, // new global team rank
      totalTeams: allTeams.length,
      userTeam,
      teamMembers: enriched
    });
  } catch (err) {
    console.error("Error fetching user draft:", err.message);
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
  // Handle multipart/form-data where values may be strings
  let { draftedArtists, teamName, profileImage } = req.body;
  if (typeof draftedArtists === "string") {
    try {
      draftedArtists = JSON.parse(draftedArtists);
    } catch (e) {
      draftedArtists = [];
    }
  }
  try {
    // Find the user's team
    const userTeam = await UserTeam.findOne({ userId });
    console.log("user team is", userTeam);
    
    if (!userTeam) {
      return res.status(404).json({ error: "User team not found" });
    }
    // Update teamName if provided (always allowed, independent of lock)
    if (Object.prototype.hasOwnProperty.call(req.body, "teamName")) {
      userTeam.teamName = teamName ?? null;
      await userTeam.save();
    }
    // Update user profile image if provided as URL or uploaded file (always allowed)
    if (req.file && req.file.filename) {
      await User.findByIdAndUpdate(userId, { profileImage: `/uploads/profile/${req.file.filename}` }, { new: true });
    } else if (Object.prototype.hasOwnProperty.call(req.body, "profileImage")) {
      await User.findByIdAndUpdate(userId, { profileImage: profileImage ?? null }, { new: true });
    }

    // If draftedArtists are provided, enforce 7-day lock for team members only
    if (Array.isArray(draftedArtists)) {
      // Compare with existing composition; if identical, do not treat as a composition change
      const existingMembers = await TeamMember.find({ teamId: userTeam._id }).select("artistId");
      const existingIds = new Set(existingMembers.map(m => String(m.artistId)));
      const incomingIds = new Set(draftedArtists.map(id => String(id)));
      const isSameSize = existingIds.size === incomingIds.size;
      const isSameSet = isSameSize && Array.from(existingIds).every(id => incomingIds.has(id));

      if (draftedArtists.length > 0 && !isSameSet) {
        const now = new Date();
        const referenceTime = userTeam.lastUpdatedAt ? new Date(userTeam.lastUpdatedAt) : new Date(userTeam.createdAt);
        const unlockTime = new Date(referenceTime.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (now < unlockTime) {
          const msRemaining = unlockTime.getTime() - now.getTime();
          const days = Math.floor(msRemaining / (24 * 60 * 60 * 1000));
          const hours = Math.floor((msRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const minutes = Math.floor((msRemaining % (60 * 60 * 1000)) / (60 * 1000));
          return res.status(403).json({
            error: "Draft is locked",
            message: `You can update your team members in ${days}d ${hours}h ${minutes}m. Team composition updates are allowed every 7 days after creation or last update.`,
            unlockAt: unlockTime
          });
        }
        // Remove old team members
        await TeamMember.deleteMany({ teamId: userTeam._id });
        // Add new team members
        const teamMembers = await Promise.all(
          draftedArtists.map(async (artistId) => {
            const category = await determineCategory(artistId);
            return {
              teamId: userTeam._id,
              artistId,
              category,
            };
          })
        );
        await TeamMember.insertMany(teamMembers);

        // Mark the time of this successful team member update to start next 7-day lock
        userTeam.lastUpdatedAt = new Date();
        await userTeam.save();

        const nextUnlockAt = new Date(userTeam.lastUpdatedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
        return res.status(200).json({
          message: "Team members updated successfully. Your team is now locked for 7 days.",
          lockedUntil: nextUnlockAt
        });
      }
    }

    // If only name/profile were updated
    return res.status(200).json({ message: "Profile/Team info updated successfully" });
  } catch (err) {
    console.error("Error updating draft:", err.message);
    res.status(500).json({ error: "Failed to update draft" });
  }
};

