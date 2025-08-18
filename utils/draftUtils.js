const Artist = require("../models/Artist");
const Tier = require("../models/Tier");

async function determineCategory(artistId) {
  try {
    // Fetch the artist's tier from the Tier model
    const tier = await Tier.findOne({ artistId }).lean();
    if (!tier) {
      // Fallback: default to Standard if no explicit tier is set
      console.warn(`Tier not found for artist ${artistId}; defaulting category to Standard`);
      return "Standard";
    }

    // Return the category based on the tier
    return tier.tier; // One of: "Legend", "Trending", "Breakout", "Standard"
  } catch (err) {
    console.error("Error determining category:", err.message);
    // Final fallback to avoid breaking draft updates
    return "Standard";
  }
}

module.exports = { determineCategory };
