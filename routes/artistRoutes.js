const express = require("express");
const router = express.Router();
const { getArtistSummary, getAllArtists, uploadArtistCSV } = require("../controllers/artistController");
const { authMiddleware, requireAdmin, requireUser } = require("../middleware/authMiddleware");
router.get("/:id/summary", getArtistSummary);
router.get("/all", getAllArtists);
router.post("/upload-csv" ,uploadArtistCSV);
module.exports = router;
