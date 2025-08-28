const express = require("express");
const router = express.Router();
const {
  scoutArtist,
  unscoutArtist,
  getMyScouts,
} = require("../controllers/scoutController");
const { authMiddleware } = require("../middleware/authMiddleware");

router.post("/:artistId", authMiddleware, scoutArtist);
router.delete("/:artistId", authMiddleware, unscoutArtist);
router.get("/me", authMiddleware, getMyScouts);

module.exports = router;
