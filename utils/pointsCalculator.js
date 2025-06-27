const UserTeam = require("../models/UserTeam");
const TeamMember = require("../models/TeamMember");
const Artist = require("../models/Artist");
const DailyScore = require("../models/DailyScore");
const User = require("../models/User");

async function updateUserPoints(userId) {
  console.log("🔄 Calculating points for user:", userId);

  const team = await UserTeam.findOne({ userId });
  if (!team) {
    console.warn("⚠️ No team found for user:", userId);
    return 0;
  }

  const members = await TeamMember.find({ teamId: team._id });
  if (!members.length) {
    console.warn("⚠️ No team members found for team:", team._id);
    return 0;
  }

  let total = 0;

  for (const member of members) {
    const latestScore = await DailyScore.findOne({ artistId: member.artistId })
      .sort({ date: -1 }); // Most recent score

    if (latestScore && typeof latestScore.totalScore === "number") {
      total += latestScore.totalScore;
    }
  }

  await User.findByIdAndUpdate(userId, { totalPoints: total });
  console.log(`✅ User ${userId} totalPoints updated: ${total}`);
  return total;
}

module.exports = { updateUserPoints };
