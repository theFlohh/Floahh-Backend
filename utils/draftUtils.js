const Artist = require("../models/Artist");
const Tier = require("../models/Tier");
async function determineCategory(artistId) {
  try {
    console.log("Looking for tier with artistId:", artistId);
    const tier = await Tier.findOne({
      artistId: new mongoose.Types.ObjectId(artistId),
    }).lean();
    console.log("Found tier:", tier);
    console.log("Looking for Tier with artistId:", artistId.toString());

    if (!tier) {
      console.warn(`No Tier found for artistId: ${artistId.toString()}`);
      return "Standard";
    }

    console.log("Found Tier:", tier);
    return tier.tier;
  } catch (err) {
    console.error("Error determining category:", err.message);
    return "Standard";
  }
}

module.exports = { determineCategory };
