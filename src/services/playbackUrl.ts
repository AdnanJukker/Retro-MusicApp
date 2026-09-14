const YOUTUBE_EMBED_PREFIX = 'youtube-embed:';
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function createEmbeddedPlaybackUrl(videoId: string): string {
  if (!YOUTUBE_VIDEO_ID.test(videoId)) throw new Error('Invalid YouTube video id.');
  return `${YOUTUBE_EMBED_PREFIX}${videoId}`;
}

export function parseEmbeddedPlaybackUrl(url: string): string | null {
  if (!url.startsWith(YOUTUBE_EMBED_PREFIX)) return null;
  const videoId = url.slice(YOUTUBE_EMBED_PREFIX.length);
  return YOUTUBE_VIDEO_ID.test(videoId) ? videoId : null;
}
