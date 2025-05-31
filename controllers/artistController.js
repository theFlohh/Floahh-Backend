const Artist = require("../models/Artist");
const DailyScore = require("../models/DailyScore");
const csv = require("csv-parser");
const multer = require("multer");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });

exports.getAllArtists = async (req, res) => {
  try {
    const artists = await Artist.find();
    res.json(artists);
  } catch (err) {
    console.error("Fetch artists error:", err.message);
    res.status(500).json({ error: "Failed to fetch artists" });
  }
};

exports.getArtistSummary = async (req, res) => {
  const artistId = req.params.id;

  try {
    const artist = await Artist.findById(artistId);
    if (!artist) return res.status(404).json({ error: "Artist not found" });

    const latestScore = await DailyScore.findOne({ artistId })
      .sort({ date: -1 })
      .lean();

    const past7 = await DailyScore.find({
      artistId,
      date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    const past30 = await DailyScore.find({
      artistId,
      date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    const weeklyTotal = past7.reduce((sum, e) => sum + e.totalScore, 0);
    const monthlyTotal = past30.reduce((sum, e) => sum + e.totalScore, 0);

    res.json({
      name: artist.name,
      spotifyId: artist.spotifyId,
      youtubeChannelId: artist.youtubeChannelId,
      chartmetricId: artist.chartmetricId || null,
      latestScore,
      weeklyTotal,
      monthlyTotal,
    });
  } catch (err) {
    console.error("Artist summary error:", err.message);
    res.status(500).json({ error: "Failed to fetch artist summary" });
  }
};



exports.uploadArtistCSV = [
  upload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "CSV file missing." });

    const artists = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => {
        artists.push({
          name: row.name,
          image: row.image,
          spotifyId: row.spotifyId,
          youtubeChannelId: row.youtubeChannelId,
          chartmetricId: row.chartmetricId,
          tiktokUsername: row.tiktokUsername,
          genres: row.genres ? row.genres.split(";").map(g => g.trim()) : [],
        });
      })
      .on("end", async () => {
        try {
          const inserted = await Artist.insertMany(artists, { ordered: false });
          fs.unlinkSync(req.file.path); // Clean up
          res.json({ success: true, inserted: inserted.length });
        } catch (err) {
          console.error("Insert error:", err.message);
          res.status(500).json({ error: "Failed to insert some or all artists." });
        }
      });
  },
];
