const Artist = require("../models/Artist");
const Tier = require("../models/Tier");

async function determineCategory(artistId) {
  try {
    // Fetch the artist's tier from the Tier model
    const tier = await Tier.findOne({ artistId }).lean();
    if (!tier) {
      throw new Error("Artist tier not found");
    }

    // Return the category based on the tier
    return tier.tier; // This should return "Legend", "Trending", or "Breakout"
  } catch (err) {
    console.error("Error determining category:", err.message);
    throw new Error("Failed to determine artist category");
  }
}

module.exports = { determineCategory };
