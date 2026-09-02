const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
]);

function normalizeHost(hostname) {
  return String(hostname || "")
    .toLowerCase()
    .replace(/^www\./, "");
}

function isValidYouTubeId(id) {
  return typeof id === "string" && YOUTUBE_ID_PATTERN.test(id);
}

/**
 * Accepts a watch / share / live / embed URL, or a bare 11-char ID.
 * Returns the video ID, or null if the input is not a valid YouTube video.
 */
function extractYouTubeVideoId(input) {
  if (typeof input !== "string") return null;

  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isValidYouTubeId(trimmed)) return trimmed;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = normalizeHost(url.hostname);
  if (!YOUTUBE_HOSTS.has(host)) return null;

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return isValidYouTubeId(id) ? id : null;
  }

  const fromQuery = url.searchParams.get("v");
  if (isValidYouTubeId(fromQuery)) return fromQuery;

  const parts = url.pathname.split("/").filter(Boolean);
  const prefixes = new Set(["embed", "live", "v", "shorts"]);
  if (parts.length >= 2 && prefixes.has(parts[0])) {
    const id = parts[1];
    return isValidYouTubeId(id) ? id : null;
  }

  return null;
}

module.exports = {
  extractYouTubeVideoId,
  isValidYouTubeId,
};
