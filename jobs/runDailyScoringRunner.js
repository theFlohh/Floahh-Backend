require('dotenv').config();
const mongoose = require("mongoose");
const { runDailyScoring } = require('./dailyScoringJob');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    await runDailyScoring();
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error in daily scoring runner:", err.message);
    process.exit(1);
  }
})();
