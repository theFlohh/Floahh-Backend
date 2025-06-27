const DailyScore = require("../models/DailyScore");
const { getChartmetricStats } = require("./chartmetricService");

function safeDiv(n, d) {
  return d && d !== 0 ? n / d : 0;
}

function monthsSince(dateStr) {
  const then = new Date(dateStr);
  const now = new Date();
  return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
}

function safePct(base, delta) {
  return base > 0 ? delta / base : 0;
}

async function fetchFullArtistMetrics(artist) {
  const chart = await getChartmetricStats(artist.chartmetricId);
  if (!chart || Object.keys(chart).length === 0) {
    console.warn(`⚠️ Skipping ${artist.name} due to missing Chartmetric data`);
    return null;
  }

  console.log(`chart for ${artist.name}  is`, chart);
  

  const stats = chart.cm_statistics || {};
  const latest = stats.latest || {};

  const spotify_listeners = stats.sp_monthly_listeners || 0;
  const avg_30d_streams = await calculateAvg30dStreams(artist._id); // New function to calculate average
  const chart_years = chart.chartmetric_join_date
    ? new Date().getFullYear() - new Date(chart.chartmetric_join_date).getFullYear()
    : 0;
  const follower_total = (stats.ins_followers || 0) + (stats.ycs_subscribers || 0);
  const releases_per_year = safeDiv(chart.num_releases || 0, chart_years || 1);
  const stream_growth_7d = safePct(spotify_listeners, stats.weekly_diff?.sp_monthly_listeners || 0);
  const tiktok_growth_7d = safePct(stats.tiktok_top_video_views || 0, stats.weekly_diff?.tiktok_top_video_views || 0);
  const momentum_score = chart.cm_artist_score || 0;
  const twitter_spike = safePct(stats.twitter_followers || 0, stats.weekly_diff?.twitter_followers || 0);
  const listener_growth_30d = await calculateListenerGrowth30d(artist._id); // New function to calculate growth
  const first_release_months = latest.earliest_album_release_date
    ? monthsSince(latest.earliest_album_release_date)
    : 999;
  const playlist_adds_per_day = safeDiv(stats.sp_playlist_total_reach || 0, 30);
  const social_growth_pct = (stats.weekly_diff_percent?.ins_followers || 0) / 100;

  return {
    spotify_listeners,
    avg_30d_streams,
    chart_years,
    follower_total,
    releases_per_year,
    stream_growth_7d,
    tiktok_growth_7d,
    momentum_score,
    twitter_spike,
    listener_growth_30d,
    first_release_months,
    playlist_adds_per_day,
    social_growth_pct
  };
}

// New function to calculate average streams over the last 30 days
async function calculateAvg30dStreams(artistId) {
  const scores = await DailyScore.find({
    artistId,
    date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  });

  const totalStreams = scores.reduce((sum, score) => sum + score.spotifyStreams, 0);
  return totalStreams / scores.length || 0; // Return average or 0 if no scores
}

// New function to calculate listener growth over the last 30 days
async function calculateListenerGrowth30d(artistId) {
  const scores = await DailyScore.find({
    artistId,
    date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  });

  const latestScore = scores[scores.length - 1]?.totalScore || 0;
  const firstScore = scores[0]?.totalScore || 0;
  return latestScore - firstScore; // Return growth
}


module.exports = { fetchFullArtistMetrics };
