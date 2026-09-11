import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import type { Track } from '@/types/music';

let player: AudioPlayer | null = null;
let subscription: { remove: () => void } | null = null;
let onStatus: ((status: AudioStatus) => void) | null = null;
let audioMode: Promise<void> | null = null;

export function setStatusListener(listener: (status: AudioStatus) => void): void {
  // Create audio only in response to a user action, never during web prerender.
  onStatus = listener;
}

export function reset(): void {
  const previous = player;
  player = null;
  subscription?.remove();
  subscription = null;
  if (previous) {
    previous.pause();
    previous.setActiveForLockScreen(false);
    previous.remove();
  }
}

export async function loadAndPlay(streamUrl: string, track: Track, signal: AbortSignal): Promise<void> {
  audioMode ??= setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  }).catch((error) => {
    audioMode = null;
    throw error;
  });
  await audioMode;
  if (signal.aborted) return;
  reset();
  const active = createAudioPlayer({ uri: streamUrl }, { updateInterval: 500 });
  player = active;
  subscription = active.addListener('playbackStatusUpdate', (status) => {
    // A delayed finish/error from the previous player cannot affect its replacement.
    if (player === active && !signal.aborted) onStatus?.(status);
  });
  active.setActiveForLockScreen(true, {
    title: track.title, artist: track.artist, albumTitle: track.album, artworkUrl: track.artwork,
  });
  active.play();
}

export function hasPlayer(): boolean { return player !== null; }
export function play(): void { player?.play(); }
export function pause(): void { player?.pause(); }
export async function seekTo(seconds: number): Promise<void> { await player?.seekTo(seconds); }
