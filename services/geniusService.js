const axios = require("axios");

const GENIUS_ACCESS_TOKEN = "VZ8O5gEisnxHUY9W0Sj02TkNLE1JwYGZLDDB4Dm7sJYsmXhcDzIMlKCUSH-WFqXp";

async function getGeniusDescription(artistName) {
  try { 
    // Search artist by name
    const searchRes = await axios.get("https://api.genius.com/search", {
      params: { q: artistName },
      headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` },
    });

    const hits = searchRes.data.response.hits;
    if (!hits || hits.length === 0) return "No description available";

    const artistId = hits[0].result.primary_artist.id;

    // Fetch artist details by ID
    const artistRes = await axios.get(`https://api.genius.com/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${GENIUS_ACCESS_TOKEN}` },
    });

    const descriptionObj = artistRes.data.response.artist.description?.children;
    console.log(`Fetched description object for ${artistName}:`, descriptionObj);
    const description = descriptionObj?.plain || descriptionObj?.html || "No description available";
console.log(`Fetched description for ${artistName}:`, description);
    return description;

  } catch (err) {
    console.error("Genius API error:", err.message);
    return "No description available";
  }
}

module.exports = { getGeniusDescription };
