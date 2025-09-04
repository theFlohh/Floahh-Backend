const axios = require("axios");
require("dotenv").config();

let accessToken = null;

const getAccessToken = async () => {
  const authOptions = {
    method: "post",
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: "grant_type=client_credentials",
  };

  try {
    const response = await axios(authOptions);
    accessToken = response.data.access_token;
    console.log("Spotify access token obtained.");
    console.log("Access Token:", accessToken);
    return accessToken;
  } catch (error) {
    console.error("Spotify token error:", error.message);
    return null;
  }
};


const getArtistData = async (spotifyId) => {
  if (!accessToken) await getAccessToken();
  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/artists/${spotifyId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data;
  } catch (error) {
    console.error(`Spotify artist error for ${spotifyId}:`, error.message);
    return null;
  }
};


const getTopTracks = async (spotifyId, market = "US") => {
  if (!accessToken) await getAccessToken();
  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/artists/${spotifyId}/top-tracks?market=${market}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    console.log(response.data.tracks,"top tracks")
    return response.data.tracks;
  } catch (error) {
    console.error(
      `Spotify top tracks error for ${spotifyId}:`,
      error.response?.data || error.message
    );

    // Retry agar token expire ho jaye
    if (error.response?.status === 401) {
      console.log("⚠️ Access token expired, refreshing...");
      await getAccessToken();
      return getTopTracks(spotifyId, market);
    }

    return [];
  }
};

const searchArtistByName = async (query) => {
  if (!accessToken) await getAccessToken();

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=5`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.data.artists.items;
  } catch (err) {
    console.error("Spotify search error:", err.message);
    return [];
  }
};

module.exports = {
  getAccessToken,
  getArtistData,
  getTopTracks,
  searchArtistByName
};
