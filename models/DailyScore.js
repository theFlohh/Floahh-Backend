const mongoose = require("mongoose");

const DailyScoreSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: "Artist" },
  date: { type: Date, required: true },
  spotifyStreams: Number,
  youtubeViews: Number,
  engagementRate: Number,
  chartmetricBuzz: Number,
  newRelease: Boolean,
  crossPlatformSpike: Boolean,
  totalScore: Number,
  tiktokFollowers: Number,
  tiktokLikes: Number,
  tiktokViews: Number,
  breakdown: {
    spotify: Number,
    youtube: Number,
    tiktok: Number,
    chartmetric: Number,
    bonus: Number,
  },
});

module.exports = mongoose.model("DailyScore", DailyScoreSchema);
