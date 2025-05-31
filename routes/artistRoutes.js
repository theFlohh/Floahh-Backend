const express = require("express");
const router = express.Router();
const { getArtistSummary, getAllArtists, uploadArtistCSV } = require("../controllers/artistController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/:id/summary", getArtistSummary);
router.get("/all", authMiddleware, getAllArtists);
router.post("/upload-csv", uploadArtistCSV); 

module.exports = router;
