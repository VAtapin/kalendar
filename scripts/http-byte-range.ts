export interface HttpByteRange {
  start: number;
  end: number;
}

/** Parses the single byte range supported by PDF downloads. Null means invalid. */
export function parseHttpByteRange(header: string | undefined, size: number): HttpByteRange | undefined | null {
  if (!header) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || size <= 0 || (!match[1] && !match[2])) return null;

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  ) return null;
  return { start, end: Math.min(requestedEnd, size - 1) };
}
