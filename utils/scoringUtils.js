function calculateSpotifyScore(topTracks) {
  let spotifyScore = 0;
  let bonus = 0;
  let newRelease = false;
  const now = new Date();

  for (const track of topTracks) {
    const popularity = track.popularity || 0;
    spotifyScore += Math.floor(popularity / 10); // Example: 90 pop = 9 pts

    const releaseDate = new Date(track.album.release_date);
    const daysOld = (now - releaseDate) / (1000 * 60 * 60 * 24);
    if (daysOld <= 7) newRelease = true;
  }

  if (newRelease) bonus += 15;

  return {
    spotifyScore,
    bonus,
    newRelease,
    totalScore: spotifyScore + bonus,
  };
}

function calculateYouTubeScore(videoStats) {
  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;

  for (const stat of videoStats) {
    totalViews += stat.views;
    totalLikes += stat.likes;
    totalComments += stat.comments;
  }

  const engagementRate =
    totalViews > 0 ? ((totalLikes + totalComments) / totalViews) * 100 : 0;

  const youtubeScore = Math.floor(totalViews / 100_000) * 10;
  const bonus = engagementRate > 10 ? 5 : 0;

  return {
    youtubeScore,
    bonus,
    engagementRate: parseFloat(engagementRate.toFixed(2)),
    totalYouTubePoints: youtubeScore + bonus,
  };
}

module.exports = {
  calculateSpotifyScore,
  calculateYouTubeScore,
};

