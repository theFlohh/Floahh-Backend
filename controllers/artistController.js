const Artist = require("../models/Artist");
const DailyScore = require("../models/DailyScore");
const csv = require("csv-parser");
const multer = require("multer");
const fs = require("fs");

const upload = multer({ dest: "uploads/" });


exports.getAllArtists = async (req, res) => {
  try {
    const artists = await Artist.find();

    const artistScores = await DailyScore.aggregate([
      {
        $group: {
          _id: "$artistId",
          totalScore: { $sum: "$totalScore" },
        },
      },
    ]);

    const scoreMap = {};
    artistScores.forEach(score => {
      scoreMap[score._id.toString()] = score.totalScore;
    });

    const enrichedArtists = artists.map(artist => {
      const totalScore = scoreMap[artist._id.toString()] || 0;
      return {
        ...artist.toObject(),
        totalScore,
      };
    });

    res.json(enrichedArtists);
  } catch (err) {
    console.error("Fetch artists error:", err.message);
    res.status(500).json({ error: "Failed to fetch artists" });
  }
};

// exports.getArtistSummary = async (req, res) => {
//   const artistId = req.params.id;

//   try {
//     const artist = await Artist.findById(artistId);
//     if (!artist) return res.status(404).json({ error: "Artist not found" });

//     const latestScore = await DailyScore.findOne({ artistId })
//       .sort({ date: -1 })
//       .lean();

//     const past7 = await DailyScore.find({
//       artistId,
//       date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
//     });

//     const past30 = await DailyScore.find({
//       artistId,
//       date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
//     });

//     const weeklyTotal = past7.reduce((sum, e) => sum + e.totalScore, 0);
//     const monthlyTotal = past30.reduce((sum, e) => sum + e.totalScore, 0);

//     res.json({
//       name: artist.name,
//       spotifyId: artist.spotifyId,
//       youtubeChannelId: artist.youtubeChannelId,
//       chartmetricId: artist.chartmetricId || null,
//       latestScore,
//       weeklyTotal,
//       monthlyTotal,
//     });
//   } catch (err) {
//     console.error("Artist summary error:", err.message);
//     res.status(500).json({ error: "Failed to fetch artist summary" });
//   }
// };

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

    // 1. Best Platform (based on breakdown score)
    const breakdown = latestScore?.breakdown || {};
    let bestPlatform = "N/A";
    let bestPlatformScore = 0;
    for (const [platform, score] of Object.entries(breakdown)) {
      if (score > bestPlatformScore) {
        bestPlatform = platform;
        bestPlatformScore = score;
      }
    }

    // 2. Platform with most views
    const viewsMap = {
      Spotify: latestScore?.spotifyStreams || 0,
      YouTube: latestScore?.youtubeViews || 0,
      TikTok: latestScore?.tiktokViews || 0,
    };
    let mostViewedPlatform = "N/A";
    let mostViews = 0;
    for (const [platform, views] of Object.entries(viewsMap)) {
      if (views > mostViews) {
        mostViews = views;
        mostViewedPlatform = platform;
      }
    }

    // 3. Rank based on totalScore on same date
    let rank = null;
    let outOf = 0;
    if (latestScore?.date) {
      const topScores = await DailyScore.aggregate([
        { $match: { date: latestScore.date } },
        { $sort: { totalScore: -1 } },
        {
          $group: {
            _id: "$artistId",
            score: { $first: "$totalScore" },
          },
        },
      ]);

      outOf = topScores.length;
      const rankIndex = topScores.findIndex(entry => entry._id.toString() === artistId.toString());
      rank = rankIndex >= 0 ? rankIndex + 1 : null;
    }

    res.json({
      name: artist.name,
      spotifyId: artist.spotifyId,
      youtubeChannelId: artist.youtubeChannelId,
      chartmetricId: artist.chartmetricId || null,
      image: artist.image || null,
      latestScore,
      weeklyTotal,
      monthlyTotal,
      bestPlatform,
      bestPlatformScore,
      mostViewedPlatform,
      mostViews,
      rank,
      outOf,
    });
  } catch (err) {
    console.error("Artist summary error:", err.message);
    res.status(500).json({ error: "Failed to fetch artist summary" });
  }
};




// exports.uploadArtistCSV = [
//   upload.single("file"),
//   async (req, res) => {
//     if (!req.file) return res.status(400).json({ error: "CSV file missing." });

//     const artists = [];

//     fs.createReadStream(req.file.path)
//       .pipe(csv())
//       .on("data", (row) => {
//         artists.push({
//           name: row.name,
//           image: row?.image || null,
//           spotifyId: row.spotifyId,
//           youtubeChannelId: row.youtubeChannelId,
//           chartmetricId: row.chartmetricId,
//           tiktokUsername: row?.tiktokUsername || null,
//           genres: row.genres ? row.genres.split(";").map(g => g.trim()) : [],
//         });
//       })
//       .on("end", async () => {
//         try {
//           const inserted = await Artist.insertMany(artists, { ordered: false });
//           fs.unlinkSync(req.file.path); // Clean up
//           res.json({ success: true, inserted: inserted.length });
//         } catch (err) {
//           console.error("Insert error:", err.message);
//           res.status(500).json({ error: "Failed to insert some or all artists." });
//         }
//       });
//   },
// ];
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
          image: row?.image || null,
          spotifyId: row.spotifyId,
          youtubeChannelId: row.youtubeChannelId,
          chartmetricId: row.chartmetricId,
          tiktokUsername: row?.tiktokUsername || null,
          genres: row.genres ? row.genres.split(";").map(g => g.trim()) : [],
        });
      })
      .on("end", async () => {
        try {
          let insertedCount = 0;
          let updatedCount = 0;

          for (const artist of artists) {
            const existing = await Artist.findOne({
              $or: [
                { spotifyId: artist.spotifyId },
                { youtubeChannelId: artist.youtubeChannelId },
                { chartmetricId: artist.chartmetricId }
              ]
            });

            if (existing) {
              const isSame =
                existing.name === artist.name &&
                existing.image === artist.image &&
                existing.tiktokUsername === artist.tiktokUsername &&
                JSON.stringify(existing.genres) === JSON.stringify(artist.genres);

              if (!isSame) {
                await Artist.updateOne({ _id: existing._id }, artist);
                updatedCount++;
              }
              // Else skip as nothing changed
            } else {
              await Artist.create(artist);
              insertedCount++;
            }
          }

          fs.unlinkSync(req.file.path); // Clean up
          res.json({ success: true, inserted: insertedCount, updated: updatedCount });

        } catch (err) {
          console.error("Processing error:", err.message);
          res.status(500).json({ error: "Error during processing." });
        }
      });
  },
];

