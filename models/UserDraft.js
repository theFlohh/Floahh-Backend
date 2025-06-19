const mongoose = require("mongoose");

const UserDraftSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  draftedArtists: [{
    artistId: { type: mongoose.Schema.Types.ObjectId, ref: "Artist" },
    tier: String,
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("UserDraft", UserDraftSchema);
