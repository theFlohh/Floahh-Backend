const mongoose = require("mongoose");

const WeeklyBonusSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: "Artist", required: true },
  type: { type: String, enum: ["topScorer", "mostImproved"], required: true },
  weekStart: { type: Date, required: true },
  bonusPoints: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("WeeklyBonus", WeeklyBonusSchema);
