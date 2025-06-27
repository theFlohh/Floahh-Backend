const mongoose = require("mongoose");

const TeamMemberSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: "UserTeam", required: true },
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: "Artist", required: true },
  category: { type: String, enum: ["Legend", "Trending", "Breakout", "Standard"], required: true },
});

module.exports = mongoose.model("TeamMember", TeamMemberSchema);
