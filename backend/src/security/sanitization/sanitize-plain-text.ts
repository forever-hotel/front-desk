function removeUnsafeControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0);

      if (codePoint === undefined) {
        return false;
      }

      const isUnsafeC0Control =
        (codePoint >= 0x00 && codePoint <= 0x08) ||
        codePoint === 0x0b ||
        codePoint === 0x0c ||
        (codePoint >= 0x0e && codePoint <= 0x1f);

      const isDeleteControl = codePoint === 0x7f;

      return !isUnsafeC0Control && !isDeleteControl;
    })
    .join('');
}

export function sanitizePlainText(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const withoutExecutableBlocks = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '');

  return removeUnsafeControlCharacters(withoutExecutableBlocks).trim();
}
