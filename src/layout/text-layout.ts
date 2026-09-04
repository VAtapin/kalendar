export interface TextLineLayout {
  text: string;
  width: number;
}

export interface TextBlockLayout {
  lines: TextLineLayout[];
  overflow: boolean;
  consumedHeight: number;
}

export type MeasureTextWidth = (text: string) => number;

function breakLongWord(
  word: string,
  maxWidth: number,
  measure: MeasureTextWidth,
): string[] {
  const parts: string[] = [];
  let part = "";
  for (const character of word) {
    const candidate = part + character;
    if (part && measure(candidate) > maxWidth) {
      parts.push(part);
      part = character;
    } else {
      part = candidate;
    }
  }
  if (part) parts.push(part);
  return parts;
}

/**
 * UI-independent line layout. Both SVG preview and PDF export use the same
 * whitespace/newline rules; only the text measurement implementation differs.
 */
export function layoutTextBlock(
  text: string,
  maxWidth: number,
  maxHeight: number,
  lineHeight: number,
  measure: MeasureTextWidth,
): TextBlockLayout {
  if (maxWidth <= 0 || maxHeight <= 0 || lineHeight <= 0) {
    return { lines: [], overflow: text.trim().length > 0, consumedHeight: 0 };
  }

  const allLines: TextLineLayout[] = [];
  const paragraphs = text.replace(/\r\n?/g, "\n").split("\n");

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      allLines.push({ text: "", width: 0 });
      continue;
    }

    let current = "";
    for (const word of words) {
      const pieces = measure(word) > maxWidth
        ? breakLongWord(word, maxWidth, measure)
        : [word];
      for (const piece of pieces) {
        const candidate = current ? `${current} ${piece}` : piece;
        if (current && measure(candidate) > maxWidth) {
          allLines.push({ text: current, width: measure(current) });
          current = piece;
        } else {
          current = candidate;
        }
      }
    }
    if (current) allLines.push({ text: current, width: measure(current) });
  }

  const maxLines = Math.max(0, Math.floor((maxHeight + 0.0001) / lineHeight));
  const lines = allLines.slice(0, maxLines);
  return {
    lines,
    overflow: allLines.length > maxLines,
    consumedHeight: lines.length * lineHeight,
  };
}
