// A presentation of verified API repetitions; source blocks and hashes stay intact.
export function repetitionNumber(count, language) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Invalid repetition count');
  const units = ['', 'а', 'в', 'г', 'д', 'є', 'ѕ', 'з', 'и', 'ѳ'];
  const tens = ['', 'і', 'к', 'л', 'м', 'н', 'ѯ', 'о', 'п', 'ч'];
  if (count > 10 && count < 20) return units[count % 10] + '҃і';
  const digits = count === 100 ? 'р' : tens[Math.floor(count / 10)] + units[count % 10];
  return digits + '҃';
}

function identity(block) {
  const { occurrenceId, repeatIndex, ...body } = block;
  return JSON.stringify(body);
}

// Only the established standalone doxology slots with the complete known wording.
export function abbreviatedDoxology(block) {
  const slot = block?.slot;
  if (!['fixed:glory', 'fixed:now', 'fixed:glory-and-now'].includes(slot) || block.kind !== 'text'
    || !Array.isArray(block.segments) || block.segments.some(segment => typeof segment.text !== 'string')) return null;
  const text = block.segments.map(segment => segment.text).join('');
  const normalized = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}]/gu, '');
  const glory = ['славаѻцꙋиснꙋистомꙋдхꙋ', 'славаотцуисынуисвятомудуху'];
  const now = ['инынѣиприснѡивовѣкивѣкѡвъаминь', 'инынеиприсноивовекивековаминь'];
  const acceptable = slot === 'fixed:glory' ? glory.includes(normalized) : slot === 'fixed:now' ? now.includes(normalized)
    : glory.some(g => now.some(n => normalized === g + n));
  if (!acceptable) return null;
  const gloryWord = text.match(/^\s*(\S+)/u)?.[1], nowWords = text.match(/и[\p{M}]*\s+н[^\s,;.]+/iu)?.[0];
  if (slot === 'fixed:glory') return gloryWord ? gloryWord + ':' : null;
  if (slot === 'fixed:now') return nowWords ? nowWords + ':' : null;
  return gloryWord && nowWords ? gloryWord + ': ' + nowWords + ':' : null;
}

export function compactRepetitions(blocks) {
  const result = [];
  for (let index = 0; index < blocks.length;) {
    const block = blocks[index], count = block.repeatCount;
    const group = typeof block.occurrenceId === 'string' && block.occurrenceId.match(/^(.*):0$/)?.[1];
    const copies = blocks.slice(index, index + count);
    const complete = Number.isInteger(count) && count > 1 && count <= 100 && block.repeatIndex === 1
      && block.kind !== 'heading' && group && copies.length === count
      && copies.every((copy, offset) => copy.repeatIndex === offset + 1
        && copy.occurrenceId === group + ':' + offset && identity(copy) === identity(block));
    let actual = complete ? count : 1;
    // Some sources provide consecutive individual occurrences instead of a repeat group.
    // Never infer a count from an incomplete or inconsistent explicit group.
    const single = item => (item.repeatCount === undefined || item.repeatCount === 1)
      && (item.repeatIndex === undefined || item.repeatIndex === 1);
    if (!complete && block.kind === 'text' && typeof block.role === 'string' && typeof block.slot === 'string'
      && block.provenance && single(block)) {
      while (actual < 100 && index + actual < blocks.length && single(blocks[index + actual])
        && identity(blocks[index + actual]) === identity(block)) actual++;
    }
    result.push({ block, count: actual });
    index += actual;
  }
  return result;
}

// A fill can arrive as one entry per block. Join only adjacent pieces of the
// same node with the same language, voice, section and other entry metadata.
export function repetitionEntries(entries) {
  const result = [];
  for (const entry of entries) {
    const previous = result.at(-1);
    const { blocks, ...context } = entry;
    const { blocks: previousBlocks, ...previousContext } = previous || {};
    if (!entry.missing && Array.isArray(blocks) && previousBlocks && JSON.stringify(context) === JSON.stringify(previousContext)) {
      previous.blocks.push(...blocks);
    } else result.push(blocks ? { ...entry, blocks: [...blocks] } : { ...entry });
  }
  return result;
}
