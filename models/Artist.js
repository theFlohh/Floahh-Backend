const mongoose = require("mongoose");

const ArtistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String },
  spotifyId: { type: String },
  youtubeChannelId: { type: String },
  tiktokUsername: { type: String },
  chartmetricId: { type: String },
  musicBrainzId: { type: String },
  genres: [String],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Artist", ArtistSchema);
