import type { Playlist } from '@/types/music';

export const mockPlaylists: Playlist[] = [
  {
    id: 'pl-latenight',
    title: 'Late Night Drive',
    description: 'Lo-fi tape saturation, ambient road reverb, and warm synth pulses.',
    art: { palette: 'accent', motif: 'peak' },
    tapeType: 'TYPE I FERRIC',
    trackIds: ['t1', 't2', 't7', 't15', 't5'],
  },
  {
    id: 'pl-sundayvinyl',
    title: 'Sunday Vinyl',
    description: 'Acoustic folk, gentle bossa nova, and dusty pressing-room warmth.',
    art: { palette: 'gold', motif: 'ring' },
    tapeType: '33⅓ RPM LP',
    trackIds: ['t3', 't4', 't16', 't12'],
  },
  {
    id: 'pl-oldschool',
    title: 'Old School',
    description: 'Hard bop sessions, boom-bap breaks, and vintage microphone hiss.',
    art: { palette: 'ink', motif: 'grid' },
    tapeType: 'MONO / ARCHIVAL',
    trackIds: ['t3', 't4', 't13', 't10'],
  },
  {
    id: 'pl-coffeejazz',
    title: 'Coffee & Jazz',
    description: 'Slow-burning horn sections for unhurried mornings.',
    art: { palette: 'olive', motif: 'sun' },
    tapeType: 'TYPE II CrO2',
    trackIds: ['t3', 't4', 't16', 't12'],
  },
  {
    id: 'pl-indierotation',
    title: 'Indie Rotation',
    description: 'Jangle pop guitars, low-output pickups, and uncompressed drums.',
    art: { palette: 'accent', motif: 'stripe' },
    tapeType: 'POSTER ART',
    trackIds: ['t8', 't9', 't6', 't14'],
  },
];
