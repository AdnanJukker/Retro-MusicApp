export type YouTubeMusicErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'NOT_PLAYABLE'
  | 'NO_AUDIO_STREAM'
  | 'INVALID_RESPONSE'
  | 'PARSER_ERROR'
  | 'UNKNOWN';

/** Typed error thrown by the YouTube Music InnerTube service layer. */
export class YouTubeMusicError extends Error {
  code: YouTubeMusicErrorCode;

  constructor(message: string, code: YouTubeMusicErrorCode) {
    super(message);
    this.name = 'YouTubeMusicError';
    this.code = code;
  }
}
