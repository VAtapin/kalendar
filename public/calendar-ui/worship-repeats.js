// A presentation of verified API repetitions; source blocks and hashes stay intact.
export function repetitionNumber(count, language) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Invalid repetition count');
  if (language !== 'cu') return String(count);
  const units = ['', 'а', 'в', 'г', 'д', 'є', 'ѕ', 'з', 'и', 'ѳ'];
  const tens = ['', 'і', 'к', 'л', 'м', 'н', 'ѯ', 'о', 'п', 'ч'];
  const digits = count === 100 ? 'р' : count > 10 && count < 20 ? units[count % 10] + 'і'
    : tens[Math.floor(count / 10)] + units[count % 10];
  return digits + '҃';
}

function identity(block) {
  const { occurrenceId, repeatIndex, ...body } = block;
  return JSON.stringify(body);
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
    result.push({ block, count: complete ? count : 1 });
    index += complete ? count : 1;
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
    if (!entry.missing && entry.nodeId && previousBlocks && JSON.stringify(context) === JSON.stringify(previousContext)) {
      previous.blocks.push(...blocks);
    } else result.push(blocks ? { ...entry, blocks: [...blocks] } : { ...entry });
  }
  return result;
}
