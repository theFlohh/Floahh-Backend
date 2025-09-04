const Artist = require("../models/Artist");
const DailyScore = require("../models/DailyScore");
const User = require("../models/User");
const { getTopTracks } = require("../services/spotifyService");
const { getChannelVideos } = require("../services/youtubeService");
const { getChartmetricStats } = require("../services/chartmetricService");
const { calculateSpotifyScore, calculateYouTubeScore } = require("../utils/scoringUtils");
const { updateUserPoints } = require("../utils/pointsCalculator");

let lastScoringTime = null; // 🆕

const runDailyScoring = async () => {
  console.log("Starting daily scoring process...");
  try {
    console.log("📊 Running daily scoring job...");

    const artists = await Artist.find();
    console.log(`Found ${artists.length} artists to score.`);
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    for (const artist of artists) {
      // Spotify
      console.log(`Scoring artist: ${artist.spotifyId}`);
      const topTracks = await getTopTracks(artist.spotifyId);
      
      const {
        totalScore: spotifyTotal,
        spotifyScore,
        bonus: spotifyBonus,
        newRelease,
      } = calculateSpotifyScore(topTracks);

      // YouTube
      let youtubeStats = [];
      let youtubeScoreData = {
        youtubeScore: 0,
        bonus: 0,
        engagementRate: 0,
        totalYouTubePoints: 0,
      };

      if (artist.youtubeChannelId) {
        youtubeStats = await getChannelVideos(artist.youtubeChannelId);
        youtubeScoreData = calculateYouTubeScore(youtubeStats);
      }

      // Chartmetric (includes TikTok now)
      let spotifyStreams = null; 
      let chartmetricScore = 0;
      let chartmetricBuzz = null;
      let crossPlatformSpike = false;

      let tiktokScore = 0;
      let tiktokFollowers = null;
      let tiktokLikes = null;
      let tiktokViews = null;

      if (artist.chartmetricId) {
        const chartData = await getChartmetricStats(artist.chartmetricId);
console.log(chartData,"chartData")
        if (chartData) {
          const stats = chartData.cm_statistics || {};
          console.log("Chartmetric stats:", stats); // 🆕 Debug log
          spotifyStreams = stats.sp_monthly_listeners || 0; // 🆕 fetch value

          // Chartmetric buzz and spike logic
          chartmetricBuzz = stats.sp_monthly_listeners || 0;
          if (chartmetricBuzz > 1000000) chartmetricScore = 10;
          else if (chartmetricBuzz > 100000) chartmetricScore = 5;
          console.log("Chartmetric buzz score:", chartmetricScore); // 🆕 Debug log
          const growthSpotify = stats.sp_monthly_listeners_rank || 0;
          console.log("Growth Spotify:", growthSpotify); // 🆕 Debug log
          const growthYouTube = stats.ycs_subscribers_rank || 0;
          console.log("Growth YouTube:", growthYouTube); // 🆕 Debug log
          if (growthSpotify < 20 && growthYouTube < 20) {
            crossPlatformSpike = true;
            chartmetricScore += 30;
          }

          // TikTok logic via Chartmetric
          tiktokFollowers = stats.tiktok_followers || 0;
          tiktokLikes = stats.tiktok_likes || 0;
          tiktokViews = stats.tiktok_top_video_views || 0;

          tiktokScore += Math.floor(tiktokFollowers / 100000) * 10;
          tiktokScore += Math.floor(tiktokLikes / 1000000) * 5;
          if (tiktokViews > 100000) tiktokScore += 10;
        }
      }

      const combinedScore =
        spotifyTotal +
        youtubeScoreData.totalYouTubePoints +
        chartmetricScore +
        tiktokScore;

      await DailyScore.findOneAndUpdate(
        { artistId: artist._id, date: today },
        {
          artistId: artist._id,
          date: today,
          spotifyStreams: spotifyStreams,
          youtubeViews: youtubeStats.reduce((sum, v) => sum + v.views, 0),
          engagementRate: youtubeScoreData.engagementRate,
          chartmetricBuzz,
          crossPlatformSpike,
          newRelease,
          tiktokFollowers,
          tiktokLikes,
          tiktokViews,
          totalScore: combinedScore,
          breakdown: {
            spotify: spotifyScore,
            youtube: youtubeScoreData.youtubeScore,
            chartmetric: chartmetricScore,
            tiktok: tiktokScore,
            bonus: spotifyBonus + youtubeScoreData.bonus,
          },
        },
        { upsert: true, new: true }
      );

      console.log(`✅ Scored ${artist.name}: ${combinedScore} pts`);
    }
    const users = await User.find({});  
for (const user of users) {
  console.log(`Updating points for user: ${user._id}`);
  await updateUserPoints(user._id);
}

     lastScoringTime = new Date();
    console.log("🎯 Daily scoring job completed.");
  } catch (err) {
    console.error("❌ Error in scoring job:", err.message);
  }
};

const getLastScoringTime = () => lastScoringTime; // 🆕

module.exports = {runDailyScoring, getLastScoringTime};
