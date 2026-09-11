import { mockAlbums } from '@/data/mockAlbums';
import { mockArtists } from '@/data/mockArtists';
import { mockPlaylists } from '@/data/mockPlaylists';
import { mockTracks } from '@/data/mockTracks';
import type { Album, Artist, Playlist, Track } from '@/types/music';

export function getTrackById(id: string): Track | undefined {
  return mockTracks.find((track) => track.id === id);
}

export function getTracksByIds(ids: string[]): Track[] {
  return ids.map(getTrackById).filter((track): track is Track => Boolean(track));
}

export function getArtistById(id: string): Artist | undefined {
  return mockArtists.find((artist) => artist.id === id);
}

export function getPlaylistById(id: string): Playlist | undefined {
  return mockPlaylists.find((playlist) => playlist.id === id);
}

export function getTracksByArtist(artistId: string): Track[] {
  return mockTracks.filter((track) => track.artistId === artistId);
}

export function getAlbumsByArtist(artistId: string): Album[] {
  return mockAlbums.filter((album) => album.artistId === artistId);
}
