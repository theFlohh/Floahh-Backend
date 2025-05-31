const express = require("express");
const router = express.Router();
const {
  fetchArtist,
  fetchTopTracks,
  searchArtist,
  saveArtist,
  searchFullArtist,
} = require("../controllers/spotifyController");

router.get("/artist/:id", fetchArtist);
router.get("/top-tracks/:id", fetchTopTracks);
router.get("/search", searchArtist);         // 🔍 Search artist by name
router.post("/add", saveArtist);             // 💾 Save artist to DB
router.get("/full-search", searchFullArtist);

module.exports = router;
