const User = require("../models/User");
const UserTeam = require("../models/UserTeam");
const FriendLeaderboard = require("../models/friendLeaderboardModel");
const DailyScore = require("../models/DailyScore");
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

    // Get weekly rank status (high/low compared to previous week)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get current week's global ranking
    const currentWeekUsers = await User.find({
      createdAt: { $gte: weekAgo }
    }).sort({ totalPoints: -1 });
    
    const currentWeekRank = currentWeekUsers.findIndex(u => u._id.toString() === userId.toString()) + 1;

    // Get previous week's global ranking (if user existed)
    const previousWeekUsers = await User.find({
      createdAt: { $gte: twoWeeksAgo, $lt: weekAgo }
    }).sort({ totalPoints: -1 });
    
    const previousWeekRank = previousWeekUsers.findIndex(u => u._id.toString() === userId.toString()) + 1;

    let weeklyRankStatus = "stable";
    if (currentWeekRank > 0 && previousWeekRank > 0) {
      if (currentWeekRank < previousWeekRank) {
        weeklyRankStatus = "high";
      } else if (currentWeekRank > previousWeekRank) {
        weeklyRankStatus = "low";
      }
    } else if (currentWeekRank > 0 && previousWeekRank === 0) {
      weeklyRankStatus = "new";
    }

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
      weeklyRankStatus: weeklyRankStatus
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

