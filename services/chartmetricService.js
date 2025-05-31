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
    return accessToken;
  } catch (err) {
    console.error("Chartmetric token error:", err.message);
    return null;
  }
}

// async function getChartmetricStats(chartmetricId) {
//   if (!accessToken) await getChartmetricToken();
//   if (!accessToken) return null;

//   try {
//     const res = await axios.get(
//      `https://api.chartmetric.com/api/artist/${chartmetricId}`,
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//         },
//       }
//     );
//     return res.data;
//   } catch (err) {
//     console.error(`Chartmetric stats error for ${chartmetricId}:`, err);
//     return null;
//   }
// }

async function getChartmetricStats(chartmetricId) {
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
    // console.log("Chartmetric full stats for artist:", res.data.obj);
    return res.data.obj; // 'obj' holds the actual artist data
  } catch (err) {
    console.error(`Chartmetric stats error for ${chartmetricId}:`, err);
    return null;
  }
}

// async function getChartmetricIdFromSpotify(spotifyId, artistName) {
//   if (!accessToken) await getChartmetricToken();
//   if (!accessToken) return null;

//   try {
//     const res = await axios.get(
//       `https://api.chartmetric.com/api/search?q=${encodeURIComponent(artistName)}`,
//       {
//         headers: {
//           Authorization: `Bearer ${accessToken}`,
//         },
//       }
//     );

//     console.log("res is", res.data.obj);
    

//     const match = res.data?.obj?.artists?.find(
//       (item) => item.spotify_id === spotifyId
//     );

//     return match?.id || null;
//   } catch (err) {
//     console.error(`Chartmetric lookup error for Spotify ID ${spotifyId}:`, err.message);
//     return null;
//   }
// }

async function getChartmetricIdFromSpotify(spotifyId, artistName) {
  if (!accessToken) await getChartmetricToken();
  if (!accessToken) return null;

  try {
    const res = await axios.get(
      `https://api.chartmetric.com/api/search?q=${encodeURIComponent(artistName)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log("ressss is", res.data.obj)

    const match = res.data?.obj?.artists?.find(
      (item) => item.spotify_id === spotifyId
    );

    return match?.id || null;
  } catch (err) {
    console.error(`Chartmetric lookup error for Spotify ID ${spotifyId}:`, err.message);
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







module.exports = {
  getChartmetricToken,
  getChartmetricStats,
  getChartmetricIdFromSpotify,
  getChartmetricSearchResults
};
