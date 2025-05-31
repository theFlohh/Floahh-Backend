const axios = require("axios");
require("dotenv").config();

const YT_API = "https://www.googleapis.com/youtube/v3";
const API_KEY = process.env.YOUTUBE_API_KEY;

const getChannelVideos = async (channelId, maxResults = 5) => {
  try {
    // Step 1: Get uploads playlist ID for the channel
    const channelRes = await axios.get(`${YT_API}/channels`, {
      params: {
        part: "contentDetails",
        id: channelId,
        key: API_KEY,
      },
    });

    const uploadsPlaylistId =
      channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) return [];

    // Step 2: Fetch latest videos from that playlist
    const playlistRes = await axios.get(`${YT_API}/playlistItems`, {
      params: {
        part: "contentDetails",
        maxResults,
        playlistId: uploadsPlaylistId,
        key: API_KEY,
      },
    });

    const videoIds = playlistRes.data.items.map(
      (item) => item.contentDetails.videoId
    );

    if (!videoIds.length) return [];

    // Step 3: Get statistics for each video
    const statsRes = await axios.get(`${YT_API}/videos`, {
      params: {
        part: "statistics",
        id: videoIds.join(","),
        key: API_KEY,
      },
    });

    const stats = statsRes.data.items.map((video) => ({
      views: parseInt(video.statistics.viewCount || 0),
      likes: parseInt(video.statistics.likeCount || 0),
      comments: parseInt(video.statistics.commentCount || 0),
    }));

    return stats;
  } catch (err) {
    console.error("YouTube fetch error:", err);
    return [];
  }
};

// NEW FUNCTION
const getChannelIdBySearch = async (query) => {
  try {
    const res = await axios.get(`${YT_API}/search`, {
      params: {
        q: query,
        type: "channel",
        maxResults: 1,
        part: "snippet",
        key: API_KEY,
      },
    });

    const channelId = res.data.items?.[0]?.id?.channelId;
    return channelId || null;
  } catch (err) {
    console.error("YouTube channel search error:", err.message);
    return null;
  }
};

module.exports = {
  getChannelVideos,
  getChannelIdBySearch
};
