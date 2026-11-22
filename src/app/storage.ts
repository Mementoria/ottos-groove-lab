/** Versioned localStorage. Nothing here throws: bad or unreachable data means fresh state. */

export interface LessonProgress {
  stepIndex: number;
  completed: boolean;
}

export interface SavedState {
  version: 1;
  lessonProgress: Record<string, LessonProgress>;
  /** Blockly serialization state per lesson id. */
  workspaces: Record<string, object>;
}

export const STORAGE_KEY = 'ottos-groove-lab:v1';

function freshState(): SavedState {
  return { version: 1, lessonProgress: {}, workspaces: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asProgress(value: unknown): LessonProgress | null {
  if (!isRecord(value)) return null;
  const { stepIndex, completed } = value;
  if (typeof stepIndex !== 'number' || !Number.isInteger(stepIndex) || stepIndex < 0) return null;
  if (typeof completed !== 'boolean') return null;
  return { stepIndex, completed };
}

/** Keeps the entries that parse; `fromEntries` defines own properties, so `__proto__` is inert. */
function validEntries<T>(value: unknown, parse: (v: unknown) => T | null): Record<string, T> {
  if (!isRecord(value)) return {};
  const kept: [string, T][] = [];
  for (const [key, entry] of Object.entries(value)) {
    const parsed = parse(entry);
    if (parsed !== null) kept.push([key, parsed]);
  }
  return Object.fromEntries(kept);
}

export function loadState(): SavedState {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Saved progress is unreachable; starting fresh.', error);
    return freshState();
  }
  if (raw === null) return freshState();

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    console.warn('Saved progress is corrupt; starting fresh.', error);
    return freshState();
  }
  if (!isRecord(data) || data['version'] !== 1) return freshState();

  return {
    version: 1,
    lessonProgress: validEntries(data['lessonProgress'], asProgress),
    workspaces: validEntries(data['workspaces'], (v) => (isRecord(v) ? v : null)),
  };
}

export function saveState(s: SavedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (error) {
    console.warn('Could not save progress (storage full or blocked).', error);
  }
}

export function resetState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Could not clear saved progress.', error);
  }
}
