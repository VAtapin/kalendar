/** Conservative evidence matching. No fuzzy result ever approves a record. */
export function evidenceText(html: string): string {
  return html.replace(/<[^>]*>/gu, " ").replace(/&(#x[\da-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/giu, (_, entity: string) => {
    const names: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (entity[0] !== "#") return names[entity.toLowerCase()] ?? _;
    const point = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : "\ufffd";
  }).replace(/\s+/gu, " ").trim();
}

export function normalizeEvidence(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ru").replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function evidenceParagraphs(html: string): string[] {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/giu)].map(match => evidenceText(match[1]!)).filter(Boolean);
}

export function containsFullTitle(paragraph: string, title: string): boolean {
  const key = normalizeEvidence(title);
  return key.length > 0 && ` ${normalizeEvidence(paragraph)} `.includes(` ${key} `);
}

/** Numeric dates are a separate check: matching only a saint's name is insufficient. */
export function historicalNumbers(text: string): string[] {
  return text.match(/\d{3,4}/gu) ?? [];
}

export function churchSlavonicTechnicalIssues(text: string): string[] {
  const issues: string[] = [];
  if (!text.trim()) issues.push("empty");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]/u.test(text)) issues.push("control-or-replacement-character");
  if (/(?:^|\s|[.,;:()])\p{M}/u.test(text)) issues.push("detached-combining-mark");
  // Roman centuries are not Latin contamination. No spelling/philology verdict here.
  if (/[A-Za-z]/u.test(text.replace(/\b[IVXLCDM]+\b/gu, ""))) issues.push("latin-letters");
  if (text.trim() && !/\p{M}/u.test(text)) issues.push("no-combining-marks");
  return issues;
}
