const Artist = require("../models/Artist");
const DailyScore = require("../models/DailyScore");
const csv = require("csv-parser");
const multer = require("multer");
const fs = require("fs");
const { getTopTracks } = require("../services/spotifyService"); // yahan tumhara spotify API helper hoga
const mongoose = require("mongoose");
const { getGeniusDescription } = require("../services/geniusService");

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

exports.getArtistSummary = async (req, res) => {
  const artistId = req.params.id;

  try {
    const artist = await Artist.findById(artistId);
    if (!artist) return res.status(404).json({ error: "Artist not found" });
const geniusDescription = await getGeniusDescription(artist.name);
console.log(`Genius description for ${artist.name}:`, geniusDescription);
    const latestScore = await DailyScore.findOne({ artistId })
      .sort({ date: -1 })
      .lean();

    // Calculate date range for last 7 days using UTC dates 
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(today.getUTCDate() - 6); // Last 7 days including today
    
    // Set time to start and end of day in UTC
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    today.setUTCHours(23, 59, 59, 999);

    console.log(`Fetching weekly stats from ${sevenDaysAgo.toISOString()} to ${today.toISOString()} for artist ${artistId}`);

    const past7 = await DailyScore.find({
      artistId: new mongoose.Types.ObjectId(artistId),
      date: { $gte: sevenDaysAgo, $lte: today }
    })
      .sort({ date: 1 })
      .lean();

    console.log(`Found ${past7.length} records for weekly stats`);

    // For monthly stats, use the same UTC approach
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(today.getUTCDate() - 29);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

    const past30 = await DailyScore.find({
      artistId: new mongoose.Types.ObjectId(artistId),
      date: { $gte: thirtyDaysAgo, $lte: today }
    });

    const weeklyPoints = past7.reduce((sum, e) => sum + e.totalScore, 0);
    const monthlyTotal = past30.reduce((sum, e) => sum + e.totalScore, 0);

    const breakdown = latestScore?.breakdown || {};
    let bestPlatform = "N/A";
    let bestPlatformScore = 0;
    for (const [platform, score] of Object.entries(breakdown)) {
      if (score > bestPlatformScore) {
        bestPlatform = platform;
        bestPlatformScore = score;
      }
    }

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

    let rank = null;
    let outOf = 0;
   if (latestScore?.date) {
  const dayStart = new Date(latestScore.date);
  dayStart.setUTCHours(0, 0, 0, 0);

  const dayEnd = new Date(latestScore.date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const topScores = await DailyScore.aggregate([
  { 
    $match: { 
      date: { $gte: dayStart, $lte: dayEnd } 
    } 
  },
  {
    $group: {
      _id: "$artistId",
      score: { $sum: "$totalScore" } // sum all scores of the day
    }
  },
  { $sort: { score: -1, _id: 1 } } // sort by score, then by artistId for tie-break
]);


  outOf = topScores.length;
  const rankIndex = topScores.findIndex(
    entry => entry._id.toString() === artistId.toString()
  );
  rank = rankIndex >= 0 ? rankIndex + 1 : null;
}


    let topTracks = [];
    if (artist.spotifyId) {
      try {
        const tracks = await getTopTracks(artist.spotifyId);
        topTracks = tracks.slice(0, 5).map(track => ({
          name: track.name,
          spotifyUrl: track.external_urls?.spotify || null,
        }));
      } catch (err) {
        console.error("Failed to fetch top tracks:", err.message);
      }
    }

    const weeklyStats = past7.map(score => ({
      date: score.date,
      totalScore: score.totalScore,
      breakdown: score.breakdown || {},
    }));

    console.log(`Weekly stats array length: ${weeklyStats.length}`);

    res.json({
      name: artist.name,
      spotifyId: artist.spotifyId,
      youtubeChannelId: artist.youtubeChannelId,
      chartmetricId: artist.chartmetricId || null,
      image: artist.image || null,
      latestScore,
      weeklyPoints,
      monthlyTotal,
      bestPlatform,
      bestPlatformScore,
      mostViewedPlatform,
      mostViews,
      rank,
      outOf,
      weeklyStats,
      topTracks,
        description: geniusDescription, // ✅ new field
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


exports.debugArtistData = async (req, res) => {
  const artistId = req.params.id;

  try {
    const artist = await Artist.findById(artistId);
    if (!artist) return res.status(404).json({ error: "Artist not found" });

    // Get all DailyScore records for this artist
    const allScores = await DailyScore.find({ artistId })
      .sort({ date: -1 })
      .lean();

    // Get the latest 10 dates from all DailyScore records
    const latestDates = await DailyScore.find({}, { date: 1 })
      .sort({ date: -1 })
      .limit(10)
      .lean();

    // Calculate date range for debugging using UTC dates
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(today.getUTCDate() - 6);
    
    // Set time to start and end of day in UTC
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    today.setUTCHours(23, 59, 59, 999);

    res.json({
      artist: {
        name: artist.name,
        id: artist._id,
        spotifyId: artist.spotifyId
      },
      dateRange: {
        today: today.toISOString(),
        sevenDaysAgo: sevenDaysAgo.toISOString(),
        searchRange: `${sevenDaysAgo.toISOString()} to ${today.toISOString()}`
      },
      totalScoresForArtist: allScores.length,
      latestScoresForArtist: allScores.slice(0, 5).map(score => ({
        date: score.date,
        totalScore: score.totalScore
      })),
      latestDatesInCollection: latestDates.map(doc => doc.date),
      weeklyStatsQuery: {
        artistId: artistId,
        dateRange: { $gte: sevenDaysAgo, $lte: today }
      },
      // Test the actual query
      testQuery: {
        artistId: new mongoose.Types.ObjectId(artistId),
        date: { $gte: sevenDaysAgo, $lte: today }
      }
    });

  } catch (err) {
    console.error("Debug artist data error:", err.message);
    res.status(500).json({ error: "Failed to debug artist data" });
  }
};

