import { evidenceText, normalizeEvidence } from "./calendar-source-audit";

export interface IdentityEvidence {
  url: string;
  displayedName: string;
  sourceLabel: string;
  surname: string;
  matchedText: string;
}

// This is a constrained declension table, not fuzzy matching. In particular,
// Petrov is never allowed to validate Petrenko, or another given name.
export function surnameGenitives(surname: string): string[] {
  const values = new Set([surname]);
  if (/(?:ов|ев|ин|ын|ич|ук)$/u.test(surname)) values.add(`${surname}а`);
  if (/(?:ий|ый|ой)$/u.test(surname)) values.add(surname.slice(0, -2) + "ого");
  if (/ая$/u.test(surname)) values.add(surname.slice(0, -2) + "ой");
  if (/(?:ова|ева|ина|ына)$/u.test(surname)) values.add(surname.slice(0, -1) + "ой");
  if (/ский$/u.test(surname)) values.add(surname.slice(0, -2) + "ого");
  if (/ская$/u.test(surname)) values.add(surname.slice(0, -2) + "ой");
  return [...values];
}

function comparable(text: string): string {
  // A Latin C in this specific source abbreviation is a documented encoding
  // variant; never globally replace Latin letters in personal names.
  return normalizeEvidence(text.replace(/\bC(?=щмч)/gu, "С").replace(/\u00ad/gu, ""));
}

/** Explicit use of the /name/ link's title as identity metadata, separately
 * from displayed calendar text. Image titles and unrelated links never qualify.
 * The result establishes textual evidence, NOT independent editorial approval.
 */
export function compareIdentityParagraph(title: string, html: string): {
  completeTextMatch: boolean;
  identities: IdentityEvidence[];
  titleWithoutVerifiedSurnames: string;
} {
  let candidate = comparable(title);
  const identities: IdentityEvidence[] = [];
  const paragraph = comparable(evidenceText(html));
  if (candidate && ` ${paragraph} `.includes(` ${candidate} `)) {
    return { completeTextMatch: true, identities, titleWithoutVerifiedSurnames: candidate };
  }
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/giu)) {
    const attrs = match[1]!;
    const url = attrs.match(/\bhref="(https:\/\/days\.pravoslavie\.ru\/name\/\d+\.html)"/iu)?.[1];
    const sourceLabel = attrs.match(/\btitle="([^"]+)"/iu)?.[1];
    if (!url || !sourceLabel) continue;
    const displayedName = evidenceText(match[2]!);
    if (!/^[А-ЯЁ][а-яё\p{M}]+$/u.test(displayedName)) continue;
    // Canonical labels contain either a parenthesized civil surname or a
    // two-word given-name/surname before the rank comma.
    const firstClause = evidenceText(sourceLabel).split(",")[0]!.replace(/\u00ad/gu, "");
    const parenthesized = /\(([А-ЯЁ][а-яё-]+)\)/u.exec(firstClause)?.[1];
    const plain = /^([А-ЯЁ][а-яё]+) ([А-ЯЁ][а-яё-]+)$/u.exec(firstClause)?.[2];
    const surname = parenthesized ?? plain;
    if (!surname) continue;
    const given = comparable(displayedName);
    for (const form of surnameGenitives(surname.toLocaleLowerCase("ru")).map(comparable)) {
      const needle = `${given} ${form}`;
      if (!` ${candidate} `.includes(` ${needle} `)) continue;
      // If the epithet/surname is already printed, preserve it. A canonical
      // two-word label is not necessarily a modern civil surname.
      if (` ${paragraph} `.includes(` ${needle} `)) continue;
      candidate = (` ${candidate} `).replace(` ${needle} `, ` ${given} `).trim();
      identities.push({ url, displayedName, sourceLabel: evidenceText(sourceLabel), surname, matchedText: needle });
      break;
    }
  }
  return { completeTextMatch: Boolean(candidate) && ` ${paragraph} `.includes(` ${candidate} `),
    identities, titleWithoutVerifiedSurnames: candidate };
}
