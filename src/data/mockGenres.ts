import type { Genre } from '@/types/music';

export const mockGenres: Genre[] = [
  { id: 'Indie', name: 'Indie', spine: 'SPINE 01', count: '1,240 REELS', palette: 'accent' },
  { id: 'Rock', name: 'Rock', spine: 'SPINE 02', count: '890 SIDES', palette: 'ink' },
  { id: 'Jazz', name: 'Jazz', spine: 'SPINE 03', count: '840 MASTERS', palette: 'gold' },
  { id: 'Electronic', name: 'Electronic', spine: 'SPINE 04', count: '612 TAPES', palette: 'olive' },
  { id: 'Hip-Hop', name: 'Hip-Hop', spine: 'SPINE 05', count: '530 PRESSINGS', palette: 'ink' },
  { id: 'Soul', name: 'Soul', spine: 'SPINE 06', count: '740 TRACKS', palette: 'accent' },
  { id: 'Classical', name: 'Classical', spine: 'SPINE 07', count: '980 SCORES', palette: 'gold' },
  { id: 'Lo-Fi', name: 'Lo-Fi', spine: 'SPINE 08', count: '420 CASSETTES', palette: 'olive' },
];
