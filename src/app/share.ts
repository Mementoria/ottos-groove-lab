/** Base64 of the UTF-8 bytes (btoa alone only takes Latin-1). */
function base64Utf8(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** A strudel.cc link that opens with `code` loaded (the format strudel.cc's own share uses). */
export function strudelUrl(code: string): string {
  return 'https://strudel.cc/#' + encodeURIComponent(base64Utf8(code));
}

/** Copies to the clipboard; false when the browser refuses or has no clipboard API. */
export async function copyCode(code: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    return false;
  }
}
