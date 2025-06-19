const mongoose = require("mongoose");

const TierSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: "Artist", required: true },
  tier: { type: String, enum: ["Legend", "Trending", "Breakout", "Standard"], required: true },
  evaluatedAt: { type: Date, default: Date.now },
});
  
module.exports = mongoose.model("Tier", TierSchema);
