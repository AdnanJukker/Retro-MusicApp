export type MusicApiErrorCode = 'timeout' | 'aborted' | 'network' | 'http' | 'invalid_response';

/** Typed error thrown by the music service layer — never a bare Error/string. */
export class MusicApiError extends Error {
  code: MusicApiErrorCode;

  constructor(message: string, code: MusicApiErrorCode) {
    super(message);
    this.name = 'MusicApiError';
    this.code = code;
  }
}
