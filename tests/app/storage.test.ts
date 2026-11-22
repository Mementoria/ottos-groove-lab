import {
  loadState,
  resetState,
  saveState,
  STORAGE_KEY,
  type SavedState,
} from '../../src/app/storage';

const FRESH: SavedState = { version: 1, lessonProgress: {}, workspaces: {} };

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the versioned key', () => {
    expect(STORAGE_KEY).toBe('ottos-groove-lab:v1');
  });

  it('returns fresh state when nothing is saved', () => {
    expect(loadState()).toEqual(FRESH);
  });

  it('returns fresh state for corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState()).toEqual(FRESH);
  });

  it('returns fresh state for an unknown version', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(loadState()).toEqual(FRESH);
  });

  it('returns fresh state for JSON that is not an object', () => {
    localStorage.setItem(STORAGE_KEY, '[1, 2]');
    expect(loadState()).toEqual(FRESH);
    localStorage.setItem(STORAGE_KEY, 'null');
    expect(loadState()).toEqual(FRESH);
  });

  it('round-trips saved state', () => {
    const state: SavedState = {
      version: 1,
      lessonProgress: { hello: { stepIndex: 2, completed: true } },
      workspaces: { hello: { blocks: { languageVersion: 0, blocks: [] } } },
    };
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it('drops only the malformed pieces of otherwise good state', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        lessonProgress: {
          good: { stepIndex: 1, completed: false },
          negative: { stepIndex: -1, completed: false },
          fractional: { stepIndex: 1.5, completed: false },
          noFlag: { stepIndex: 0 },
          text: 'nope',
        },
        workspaces: { good: { blocks: {} }, bad: 'nope', list: [1] },
      }),
    );
    expect(loadState()).toEqual({
      version: 1,
      lessonProgress: { good: { stepIndex: 1, completed: false } },
      workspaces: { good: { blocks: {} } },
    });
  });

  it('treats missing sections as empty', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1 }));
    expect(loadState()).toEqual(FRESH);
  });

  it('does not let a saved "__proto__" key touch the prototype', () => {
    localStorage.setItem(
      STORAGE_KEY,
      '{"version":1,"lessonProgress":{"__proto__":{"stepIndex":0,"completed":true}},"workspaces":{}}',
    );
    const state = loadState();
    expect(Object.getPrototypeOf(state.lessonProgress)).toBe(Object.prototype);
    expect(Object.keys(state.lessonProgress)).toEqual(['__proto__']);
  });

  it('returns fresh state when localStorage itself throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(loadState()).toEqual(FRESH);
  });

  it('does not throw when saving fails (e.g. over quota), and warns', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => {
      saveState(FRESH);
    }).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it('resets to fresh state', () => {
    saveState({ ...FRESH, lessonProgress: { a: { stepIndex: 0, completed: true } } });
    resetState();
    expect(loadState()).toEqual(FRESH);
  });

  it('does not throw when resetting fails', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => {
      resetState();
    }).not.toThrow();
  });
});
