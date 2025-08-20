const express = require("express");
const router = express.Router();
const { getArtistsByTier } = require("../controllers/tierController");

    router.get("/:tierName", getArtistsByTier);
module.exports = router;
