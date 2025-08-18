const {
  getArtistData,
  getTopTracks,
  searchArtistByName
} = require("../services/spotifyService");
const Artist = require("../models/Artist");
const { getChartmetricStats, getChartmetricIdFromSpotify, getChartmetricSearchResults } = require("../services/chartmetricService");
const { getChannelIdBySearch } = require("../services/youtubeService");

exports.searchArtist = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing search query." });

  const results = await searchArtistByName(q);
  res.json(results);
};

exports.saveArtist = async (req, res) => {
  const { name, spotifyId, genres, youtubeChannelId, chartmetricId, tiktokUsername } = req.body;

  try {
    const artist = await Artist.create({ name, spotifyId, genres, youtubeChannelId, chartmetricId, tiktokUsername });
    res.json({ success: true, artist });
  } catch (err) {
    res.status(500).json({ error: "Failed to save artist." });
  }
};


exports.fetchArtist = async (req, res) => {
  try {
    const artist = await getArtistData(req.params.id);
    res.json(artist);
  } catch (err) {
    console.error("Fetch artist error:", err.message);
    res.status(500).json({ error: "Failed to fetch artist info" });
  }
};

exports.fetchTopTracks = async (req, res) => {
  try {
    const tracks = await getTopTracks(req.params.id);
    
    res.json(tracks);
  } catch (err) {
    console.error("Fetch top tracks error:", err.message);
    res.status(500).json({ error: "Failed to fetch top tracks" });
  }
};

exports.searchFullArtist = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing artist name query." });

  try {
    const results = await searchArtistByName(q);

    const enriched = await Promise.all(
      results.map(async (artist) => {
        let chartmetricId = null;
        let tiktokUsername = null;
        let youtubeChannelId = null;

        // Step 1: Search Chartmetric by name (not ID)
        const cmSearchRes = await getChartmetricSearchResults(artist.name);
        const match = cmSearchRes?.obj?.artists?.find(
          (entry) => entry.name.toLowerCase() === artist.name.toLowerCase()
        );

        if (match?.id) {
          chartmetricId = match.id;

          // Step 2: Fetch full data from Chartmetric by numeric ID
          const cmStats = await getChartmetricStats(chartmetricId);

          if (cmStats) {
            tiktokUsername = cmStats.tiktok_username || null;
            youtubeChannelId = cmStats.youtube_channel_id || null;
          }
        }

        // Step 3: Fallback to YouTube search
        if (!youtubeChannelId) {
          youtubeChannelId = await getChannelIdBySearch(artist.name);
        }

        return {
          name: artist.name,
          spotifyId: artist.id,
          genres: artist.genres,
          chartmetricId,
          tiktokUsername,
          youtubeChannelId,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error("searchFullArtist error:", err.message);
    res.status(500).json({ error: "Failed to fetch enriched artist data" });
  }
};
