/**
 * Minimal raw InnerTube response shapes — only the fields this app actually
 * reads. Everything is optional/unknown-tolerant since InnerTube is an
 * unofficial, unversioned API: a missing field must degrade gracefully,
 * never crash a parser.
 */

export interface Run {
  text?: string;
  navigationEndpoint?: {
    watchEndpoint?: { videoId?: string };
    browseEndpoint?: { browseId?: string };
  };
}

export interface RunsText {
  runs?: Run[];
}

export interface Thumbnail {
  url?: string;
  width?: number;
  height?: number;
}

export interface FlexColumn {
  musicResponsiveListItemFlexColumnRenderer?: {
    text?: RunsText;
  };
}

export interface MusicResponsiveListItemRenderer {
  flexColumns?: FlexColumn[];
  thumbnail?: {
    musicThumbnailRenderer?: {
      thumbnail?: { thumbnails?: Thumbnail[] };
    };
  };
  overlay?: {
    musicItemThumbnailOverlayRenderer?: {
      content?: {
        musicPlayButtonRenderer?: {
          playNavigationEndpoint?: {
            watchEndpoint?: { videoId?: string };
          };
        };
      };
    };
  };
}

export interface SearchResponse {
  contents?: {
    tabbedSearchResultsRenderer?: {
      tabs?: {
        tabRenderer?: {
          content?: {
            sectionListRenderer?: {
              contents?: {
                musicShelfRenderer?: {
                  title?: RunsText;
                  contents?: { musicResponsiveListItemRenderer?: MusicResponsiveListItemRenderer }[];
                };
              }[];
            };
          };
        };
      }[];
    };
  };
}

export interface AdaptiveFormat {
  itag?: number;
  mimeType?: string;
  bitrate?: number;
  averageBitrate?: number;
  contentLength?: string;
  audioQuality?: string;
  approxDurationMs?: string;
  url?: string;
  signatureCipher?: string;
  cipher?: string;
}

export interface PlayerResponse {
  playabilityStatus?: {
    status?: string;
    reason?: string;
  };
  streamingData?: {
    expiresInSeconds?: string;
    adaptiveFormats?: AdaptiveFormat[];
    formats?: AdaptiveFormat[];
  };
  videoDetails?: {
    videoId?: string;
    title?: string;
    lengthSeconds?: string;
    author?: string;
  };
}

export interface NextResponse {
  contents?: {
    singleColumnMusicWatchNextResultsRenderer?: {
      tabbedRenderer?: {
        watchNextTabbedResultsRenderer?: {
          tabs?: {
            tabRenderer?: {
              unselectable?: boolean;
              endpoint?: {
                browseEndpoint?: {
                  browseId?: string;
                  browseEndpointContextSupportedConfigs?: {
                    browseEndpointContextMusicConfig?: { pageType?: string };
                  };
                };
              };
            };
          }[];
        };
      };
    };
  };
}

export interface BrowseLyricsResponse {
  contents?: {
    sectionListRenderer?: {
      contents?: {
        musicDescriptionShelfRenderer?: {
          description?: RunsText;
          footer?: RunsText;
        };
      }[];
    };
  };
}

/** A public Piped instance's `GET /streams/{videoId}` response — used only as a
 *  fallback when InnerTube gives no direct URL. Piped deciphers server-side. */
export interface PipedStreamsResponse {
  audioStreams?: PipedAudioStream[];
}

export interface PipedAudioStream {
  url?: string;
  mimeType?: string;
  codec?: string;
  bitrate?: number;
  contentLength?: number;
  quality?: string;
  videoOnly?: boolean;
}

/** Response shape of the optional self-hosted `server/` resolver (`GET /resolve/{videoId}`). */
export interface SelfHostedResolverResponse {
  url?: string;
  mimeType?: string;
  bitrate?: number;
  durationSeconds?: number;
}

/** Normalized, app-facing audio format selected out of `adaptiveFormats`. */
export interface AudioStream {
  url: string;
  mimeType?: string;
  bitrate?: number;
  contentLength?: number;
  audioQuality?: string;
}
