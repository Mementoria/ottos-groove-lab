import type { BlockType } from '../../blocks/blockTypes';
import type { Lesson } from '../types';

/** The course, in order. Content tasks fill this in. */
export const course: Lesson[] = [];

/** Cumulative toolbox: the union of `unlocks` for lessons 0 through `lessonIndex`. */
export function unlockedFor(lessonIndex: number): BlockType[] {
  const unlocked = new Set<BlockType>();
  for (const lesson of course.slice(0, lessonIndex + 1)) {
    for (const type of lesson.unlocks) unlocked.add(type);
  }
  return [...unlocked];
}
