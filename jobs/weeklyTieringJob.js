// const Artist = require("../models/Artist");
// const Tier = require("../models/Tier");
// const { fetchFullArtistMetrics } = require("../services/platformAggregator");
// const { classifyArtist } = require("../utils/tierUtils");

// const runWeeklyTiering = async () => {
//   console.log("🎯 Running weekly tier classification...");

//   const artists = await Artist.find();

// //   for (const artist of artists) {
// //     const metrics = await fetchFullArtistMetrics(artist);
// //     console.log(`metrics for ${artist.name} is`, metrics);
    
// //     if (!metrics) continue;

// //     const tier = classifyArtist(metrics);

// //     await Tier.findOneAndUpdate(
// //       { artistId: artist._id },
// //       { tier, evaluatedAt: new Date() },
// //       { upsert: true }
// //     );

// //     console.log(`✅ ${artist.name} => ${tier}`);
// //   }

// for (const artist of artists) {
//   const metrics = await fetchFullArtistMetrics(artist);
//   console.log(`📊 Metrics for ${artist.name}:`, metrics);

//   if (!metrics) {
//     console.warn(`⚠️ Skipping ${artist.name} due to null metrics`);
//     continue;
//   }

//   console.log("metrics are", metrics)
//   const tier = classifyArtist(metrics);
//   await Artist.updateOne({ _id: artist._id }, {
//     $set: {
//       tier,
//       evaluatedAt: new Date(),
//     },
//   });

//   console.log(`✅ ${artist.name} => ${tier}`);
  
//   await new Promise(r => setTimeout(r, 1100)); // 1.1s delay to prevent 429
// }

//   console.log("✅ Tier classification completed.");
// };

// module.exports = runWeeklyTiering;


const Artist = require("../models/Artist");
const Tier = require("../models/Tier");
const { fetchFullArtistMetrics } = require("../services/platformAggregator");
const { classifyArtist } = require("../utils/tierUtils");

const runWeeklyTiering = async () => {
  console.log("🎯 Running weekly tier classification...");

  const artists = await Artist.find();

  for (const artist of artists) {
    const metrics = await fetchFullArtistMetrics(artist);
    console.log(`📊 Metrics for ${artist.name}:`, metrics);

    if (!metrics) {
      console.warn(`⚠️ Skipping ${artist.name} due to null metrics`);
      continue;
    }

    const tier = classifyArtist(metrics);
    
    // Update the Tier model instead of the Artist model
    await Tier.findOneAndUpdate(
      { artistId: artist._id }, // Match by artist ID
      { tier, evaluatedAt: new Date() }, // Update tier and evaluation date
      { upsert: true } // Create a new document if it doesn't exist
    );

    console.log(`✅ ${artist.name} => ${tier}`);
    
    await new Promise(r => setTimeout(r, 1100)); // 1.1s delay to prevent 429
  }

  console.log("✅ Tier classification completed.");
};

module.exports = runWeeklyTiering;

