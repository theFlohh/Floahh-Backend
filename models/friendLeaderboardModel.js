const mongoose = require("mongoose");

const friendLeaderboardSchema = new mongoose.Schema({
  name: String,
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("FriendLeaderboard", friendLeaderboardSchema);
