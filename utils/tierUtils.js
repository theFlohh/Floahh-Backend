// function classifyArtist(metrics) {
//   if (!metrics) return "Standard";

//   if (
//     metrics.spotify_listeners > 5000000 &&
//     metrics.avg_30d_streams > 20000000 &&
//     metrics.chart_years >= 3 &&
//     metrics.follower_total > 3000000 &&
//     metrics.releases_per_year >= 1
//   ) return "Legend";

//   if (
//     metrics.stream_growth_7d >= 0.15 ||
//     metrics.tiktok_growth_7d >= 0.2 ||
//     metrics.momentum_score > 70 ||
//     metrics.twitter_spike >= 0.25 ||
//     metrics.billboard_jump >= 5
//   ) return "Trending";

//   if (
//     metrics.spotify_listeners < 1000000 &&
//     metrics.listener_growth_30d >= 0.3 &&
//     metrics.first_release_months <= 6 &&
//     metrics.playlist_adds_per_day >= 1000 &&
//     metrics.social_growth_pct >= 0.1
//   ) return "Breakout";

//   return "Standard";
// }

function classifyArtist(metrics) {
  const {
    spotify_listeners,
    avg_30d_streams,
    chart_years,
    follower_total,
    releases_per_year,
    stream_growth_7d,
    tiktok_growth_7d,
    momentum_score,
    twitter_spike,
    billboard_jump,
    listener_growth_30d,
    first_release_months,
    playlist_adds_per_day,
    social_growth_pct
  } = metrics;

  // Legend: Adjusted to fields we trust
  if (
    spotify_listeners > 5_000_000 &&
    follower_total > 5_000_000 &&
    momentum_score > 70
  ) {
    return 'Legend';
  }

  // Trending
  if (
    stream_growth_7d >= 500_000 || // using absolute instead of % because we have raw delta
    tiktok_growth_7d >= 0.02 ||
    momentum_score > 70 ||
    twitter_spike >= 0.25 ||
    billboard_jump >= 5
  ) {
    return 'Trending';
  }

  // Breakout
  if (
    spotify_listeners < 1_000_000 &&
    listener_growth_30d >= 1_000_000 &&
    first_release_months <= 6 &&
    playlist_adds_per_day >= 1000 &&
    social_growth_pct >= 0.10
  ) {
    return 'Breakout';
  }

  return 'Standard';
}


module.exports = { classifyArtist };
