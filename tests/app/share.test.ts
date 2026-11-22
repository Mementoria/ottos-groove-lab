import { copyCode, strudelUrl } from '../../src/app/share';

const PREFIX = 'https://strudel.cc/#';

function decode(url: string): string {
  expect(url.startsWith(PREFIX)).toBe(true);
  const binary = atob(decodeURIComponent(url.slice(PREFIX.length)));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

describe('strudelUrl', () => {
  it('base64-encodes ASCII code into the hash', () => {
    expect(strudelUrl('s("bd")')).toBe(PREFIX + encodeURIComponent(btoa('s("bd")')));
  });

  it('round-trips non-ASCII code as UTF-8', () => {
    expect(decode(strudelUrl('// ♪'))).toBe('// ♪');
  });

  it('round-trips a multi-line program', () => {
    const code = 'setcpm(120/4)\n\n$: s("bd*4")\n  .bank("RolandTR909")\n';
    expect(decode(strudelUrl(code))).toBe(code);
  });
});

describe('copyCode', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  function stubClipboard(writeText: (text: string) => Promise<void>): void {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  }

  it('writes the code to the clipboard', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    stubClipboard(writeText);
    await expect(copyCode('s("bd")')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('s("bd")');
  });

  it('reports failure when the clipboard refuses', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    await expect(copyCode('x')).resolves.toBe(false);
  });

  it('reports failure when there is no clipboard', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await expect(copyCode('x')).resolves.toBe(false);
  });
});
