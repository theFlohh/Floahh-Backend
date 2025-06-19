const Tier = require("../models/Tier");
const Artist = require("../models/Artist");

exports.getArtistsByTier = async (req, res) => {
  const { tierName } = req.params;
  try {
    const tiers = await Tier.find({ tier: tierName }).populate("artistId");
    const artists = tiers.map((t) => t.artistId);
    res.json(artists);
  } catch (err) {
    console.error("Tier fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch artists by tier" });
  }
};
