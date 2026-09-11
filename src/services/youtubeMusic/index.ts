export {
  YouTubeMusicProvider,
  musicProvider,
  searchTracks,
  getStreamUrl,
  getLyrics,
  getDiscoveryTracks,
  getStreamUrlCached,
  invalidateStreamUrl,
  searchSongs,
  getAudioStream,
} from '@/services/youtubeMusic/YouTubeMusicProvider';
export { YouTubeMusicError } from '@/services/youtubeMusic/errors';
export type { YouTubeMusicErrorCode } from '@/services/youtubeMusic/errors';
export type { AudioStream } from '@/services/youtubeMusic/innertubeTypes';
export { selectBestAudioStream } from '@/services/youtubeMusic/innertubeParsers';
