require('dotenv').config();
const mongoose = require("mongoose");
const runWeeklyTiering = require('./weeklyTieringJob');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    await runWeeklyTiering();
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error in weekly tiering runner:", err.message);
    process.exit(1);
  }
})();
