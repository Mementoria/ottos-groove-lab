/** One Song Studio style. Otto holds each style with one of his eight arms. */
export interface SongStyle {
  id: string;
  name: string;
  /** Which of Otto's arms (0–7) holds this style's card. */
  arm: number;
  /** The lesson that builds this style's song; omit while it is still coming soon. */
  lessonId?: string;
}

/** The eight Song Studio styles (spec §5.7), in map order. Milestone 3 fills in the rest. */
export const SONG_STYLES: readonly SongStyle[] = [
  { id: 'acid', name: 'Acid', arm: 0, lessonId: 'song-acid' },
  { id: 'house', name: 'House', arm: 1 },
  { id: 'techno', name: 'Techno', arm: 2 },
  { id: 'lofi', name: 'Lo-fi hip hop', arm: 3 },
  { id: 'ambient', name: 'Ambient', arm: 4 },
  { id: 'classical', name: 'Classical', arm: 5 },
  { id: 'jazz', name: 'Jazz', arm: 6 },
  { id: 'pop', name: 'Pop', arm: 7 },
];
