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

// Printed services can allocate each copy to a separate fixed node.
// Compare the source and voice, and keep the original repeated prayer intact.
function sameSourceMercy(a, b, offset = 1) {
  if (!a || !b || a.kind !== 'text' || b.kind !== 'text' || a.role !== b.role
    || JSON.stringify(a.segments) !== JSON.stringify(b.segments)
    || ![a, b].every(x => (x.repeatCount === undefined || x.repeatCount === 1)
      && (x.repeatIndex === undefined || x.repeatIndex === 1))) return false;
  const ap = a.provenance, bp = b.provenance;
  if (!ap || !bp) return false;
  if (ap.endingReference === 'mercy' && bp.endingReference === 'mercy') {
    return JSON.stringify(ap) === JSON.stringify(bp);
  }
  // The source compiler marks original copies with a shared parent occurrence.
  const am = ap.parentOccurrenceId?.match(/^(.*):(\d+)$/), bm = bp.parentOccurrenceId?.match(/^(.*):(\d+)$/);
  if (!am || !bm || am[1] !== bm[1] || Number(bm[2]) !== Number(am[2]) + offset) return false;
  const { parentOccurrenceId: ai, ...asource } = ap, { parentOccurrenceId: bi, ...bsource } = bp;
  return JSON.stringify(asource) === JSON.stringify(bsource);
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
    if (!complete && block.kind === 'text' && typeof block.role === 'string'
      && block.provenance && single(block)) {
      while (actual < 100 && index + actual < blocks.length && single(blocks[index + actual])
        && ((typeof block.slot === 'string' && identity(blocks[index + actual]) === identity(block))
          || sameSourceMercy(block, blocks[index + actual], actual))) actual++;
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
    const { nodeId: node, ...nodeContext } = context;
    const { nodeId: previousNode, ...previousNodeContext } = previousContext;
    const adjacentMercyNodes = entry.kind === 'fixed' && previous?.kind === 'fixed'
      && typeof node === 'string' && typeof previousNode === 'string'
      && JSON.stringify(nodeContext) === JSON.stringify(previousNodeContext)
      && sameSourceMercy(previousBlocks?.at(-1), blocks?.[0]);
    if (!entry.missing && Array.isArray(blocks) && previousBlocks
      && (JSON.stringify(context) === JSON.stringify(previousContext) || adjacentMercyNodes)) {
      previous.blocks.push(...blocks);
    } else result.push(blocks ? { ...entry, blocks: [...blocks] } : { ...entry });
  }
  return result;
}
