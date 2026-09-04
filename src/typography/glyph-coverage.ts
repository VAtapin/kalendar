/**
 * Conservative common coverage used before export. The bundled fonts cover
 * Latin, Cyrillic (including Church-Slavonic extensions), punctuation and
 * common symbols. Characters outside these ranges need an explicit font proof.
 */
export function unsupportedGlyphs(text: string): string[] {
  const unsupported = new Set<string>();
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    const covered =
      code === 0x09 || code === 0x0a || code === 0x0d ||
      (code >= 0x20 && code <= 0x024f) ||
      (code >= 0x0300 && code <= 0x036f) ||
      (code >= 0x0400 && code <= 0x052f) ||
      (code >= 0x1c80 && code <= 0x1c8f) ||
      (code >= 0x2000 && code <= 0x206f) ||
      (code >= 0x20a0 && code <= 0x20cf) ||
      (code >= 0x2100 && code <= 0x214f) ||
      (code >= 0x2190 && code <= 0x21ff) ||
      (code >= 0x25a0 && code <= 0x26ff) ||
      (code >= 0x2de0 && code <= 0x2dff) ||
      (code >= 0xa640 && code <= 0xa69f);
    if (!covered) unsupported.add(character);
  }
  return [...unsupported];
}
