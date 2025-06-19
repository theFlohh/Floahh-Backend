const mongoose = require("mongoose");

const DraftStatsSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: "Artist", required: true },
  totalDrafts: { type: Number, default: 0 },
  scoreModifier: { type: Number, default: 1 },
});

module.exports = mongoose.model("DraftStats", DraftStatsSchema);
