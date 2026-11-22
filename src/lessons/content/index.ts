import type { BlockType } from '../../blocks/blockIds';
import type { Lesson } from '../types';
import { acidSong } from './acid';
import { module0 } from './module0';
import { module1 } from './module1';
import { module2 } from './module2';

/** The course, in order. */
export const course: Lesson[] = [...module0, ...module1, ...module2, ...acidSong];

/** Cumulative toolbox: the union of `unlocks` for lessons 0 through `lessonIndex`. */
export function unlockedFor(lessonIndex: number, lessons: readonly Lesson[] = course): BlockType[] {
  const unlocked = new Set<BlockType>();
  for (const lesson of lessons.slice(0, lessonIndex + 1)) {
    for (const type of lesson.unlocks) unlocked.add(type);
  }
  return [...unlocked];
}
