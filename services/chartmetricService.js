const axios = require("axios");

let accessToken = null;

async function getChartmetricToken() {
  try {
    const response = await axios.post(
      "https://api.chartmetric.com/api/token",
      { refreshtoken: process.env.CHARTMETRIC_REFRESH_TOKEN },
      { headers: { "Content-Type": "application/json" } }
    );
    accessToken = response.data.token;
    console.log("Chartmetric access token obtained.");
    console.log("Access Token:", accessToken); // 🆕 Debug log
    return accessToken;
  } catch (err) {
    console.error("Chartmetric token error:", err.message);
    return null;
  }
}

async function getChartmetricStats(chartmetricId) {
  if (!chartmetricId) {
    console.log("⚠️ Empty chartmetricId passed, skipping...");
    return null;
  }

  if (!accessToken) await getChartmetricToken();
  if (!accessToken) return null;

  try {
    const res = await axios.get(
      `https://api.chartmetric.com/api/artist/${chartmetricId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const parsed = parseChartmetricMetrics(res.data.obj);
    console.log("Parsed Chartmetric data:", parsed); // 🆕 Debug log
    return res.data.obj;
  } catch (err) {
    console.error(`Chartmetric stats error for ${chartmetricId}:`, err.message);
    return null;
  }
}

async function getChartmetricIdFromSpotify(spotifyId, artistName) {
  if (!accessToken) await getChartmetricToken();
  if (!accessToken) return null;

  try {
    const res = await axios.get(
      `https://api.chartmetric.com/api/search?q=${encodeURIComponent(
        artistName
      )}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log("ressss is", res.data.obj);
    console.log(
      "Searching Chartmetric for Spotify ID:",
      spotifyId,
      "or Name:",
      artistName
    );

    const match = res.data?.obj?.artists?.find(
      (item) => item.spotify_id === spotifyId
    );
    console.log("Match found in Chartmetric:", match);
    return match?.id;
  } catch (err) {
    console.error(
      `Chartmetric lookup error for Spotify ID ${spotifyId}:`,
      err.message
    );
    return null;
  }
}

async function getChartmetricSearchResults(name) {
  if (!accessToken) await getChartmetricToken();
  if (!accessToken) return null;

  try {
    const res = await axios.get(
      `https://api.chartmetric.com/api/search?q=${encodeURIComponent(name)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return res.data;
  } catch (err) {
    console.error(`Chartmetric search error for name ${name}:`, err.message);
    return null;
  }
}
function parseChartmetricMetrics(data) {
  console.log("Raw Chartmetric data:", data);
  const stats = data?.cm_statistics?.latest || {};
  console.log("Latest statistics:", stats);
  const monthlyStats = data?.cm_statistics?.monthly_diff || {};
  const weeklyStats = data?.cm_statistics?.weekly_diff || {};
  const score = data?.cm_statistics?.latest?.rank?.overall?.score_100;
  console.log("Momentum score:", score);

  const tiktokGrowth =
    data?.cm_statistics?.weekly_diff_percent?.tiktok_track_posts || 0;

  const twitterSpike =
    data?.cm_statistics?.weekly_diff_percent?.twitter_followers || 0;

  const socialGrowthPct =
    data?.cm_statistics?.monthly_diff_percent?.ins_followers || 0;

  const followersTotal =
    (data?.cm_statistics?.sp_followers || 0) +
    (data?.cm_statistics?.ins_followers || 0) +
    (data?.cm_statistics?.ycs_subscribers || 0);

  return {
    spotify_listeners: data?.cm_statistics?.sp_monthly_listeners || 0,
    avg_30d_streams: 0, // You don't have this yet, can integrate later
    chart_years: estimateYearsFrom(data?.created_at),
    follower_total: followersTotal,
    releases_per_year: 0, // Need manual integration or external source
    stream_growth_7d: weeklyStats?.sp_monthly_listeners || 0,
    tiktok_growth_7d: tiktokGrowth,
    momentum_score: score || 0,
    twitter_spike: twitterSpike,
    billboard_jump: 0, // Optional
    listener_growth_30d: monthlyStats?.sp_monthly_listeners || 0,
    first_release_months: 200, // Optional; set a default or fetch properly
    playlist_adds_per_day: stats?.spotify_playlist_count || 0,
    social_growth_pct: socialGrowthPct || 0,
  };
}

function estimateYearsFrom(dateString) {
  if (!dateString) return NaN;
  const created = new Date(dateString);
  const now = new Date();
  const diffYears = (now - created) / (1000 * 60 * 60 * 24 * 365);
  return Math.floor(diffYears);
}
module.exports = {
  getChartmetricToken,
  getChartmetricStats,
  getChartmetricIdFromSpotify,
  getChartmetricSearchResults,
};
