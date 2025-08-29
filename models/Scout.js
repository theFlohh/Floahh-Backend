const mongoose = require("mongoose");

const ScoutSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    artistId: { type: mongoose.Schema.Types.ObjectId, ref: "Artist", required: true },
  },
  { timestamps: true }
);

ScoutSchema.index({ userId: 1, artistId: 1 }, { unique: true });

module.exports = mongoose.model("Scout", ScoutSchema);
