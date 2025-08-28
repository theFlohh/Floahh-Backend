const mongoose = require("mongoose");
const Scout = require("../models/Scout");
const Artist = require("../models/Artist");
const { determineCategory } = require("../utils/draftUtils");
const DailyScore = require("../models/DailyScore");

// ✅ Scout artist
exports.scoutArtist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { artistId } = req.params;

    // 1. Artist check karo
    const artist = await Artist.findById(artistId).lean();
    if (!artist) {
      return res.status(404).json({ error: "Artist not found" });
    }

    // 2. Check karo agar pehle se scouted hai
    const existingScout = await Scout.findOne({ userId, artistId });
    if (existingScout) {
      return res
        .status(400)
        .json({ error: "This artist is already scouted by you" });
    }

    // 3. Naya scout save karo
    const scout = new Scout({ userId, artistId });
    await scout.save();

    res.json({ success: true, scout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Unscout artist
exports.unscoutArtist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { artistId } = req.params;

    await Scout.findOneAndDelete({ userId, artistId });
    res.json({ success: true, message: "Unscouted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get all scouted artists for user (with category)
exports.getMyScouts = async (req, res) => {
  try {
    const userId = req.user._id;

    // User ke scouted artists le ao
    const scouts = await Scout.find({ userId }).populate("artistId", "name genres image");

    const result = [];
    for (let s of scouts) {
      const artist = s.artistId;

      // Category find karo
      const category = await determineCategory(artist._id);

      // Latest score lao
      const latestScore = await DailyScore.findOne({ artistId: artist._id })
        .sort({ date: -1 })
        .lean();

      result.push({
        artistId: artist._id,
        name: artist.name,
        genres: artist.genres || [],
        image: artist.image || null,
        category,
        latestScore: latestScore ? latestScore.totalScore : 0, // sirf total score chahiye
        scoutedAt: s.createdAt,
      });
    }

    res.json({ scouts: result });
  } catch (err) {
    console.error("Error fetching scouts:", err.message);
    res.status(500).json({ error: err.message });
  }
};