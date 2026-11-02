import { partsHash, textHash } from './worship-hash.js';

// Provenance verification only. Each service must bind its own allowed target and input first.
async function same(a, b) { return await partsHash(a) === await partsHash(b); }
export async function validateSourceUserLiteral(block, literal, field, hash, source, contract, binding, mode, markerCandidates = []) {
  const p = block.provenance, user = p?.userInput, frame = p?.sourceFrame;
  if (user?.origin !== 'user-provided' || user.field !== field || user.grammaticalCase !== binding.grammaticalCase || user.inputHash !== hash || user.literalConfirmed !== true
    || user.morphologyInferred !== false || user.serviceSourceAttestation !== false || user.currentAuthorityAttestation !== false
    || frame?.work !== source.work || frame.edition !== source.edition || frame.language !== 'cu' || frame.bodyHash !== source.hash
    || frame.sourceHash !== source.sourceHash || frame.block !== contract.sourceBlock || !await same(frame.sourceRange, contract.sourceRange)
    || !await same(frame.markerRange, binding.markerRange) || !Array.isArray(p.sourcePieces) || !Array.isArray(p.segmentOrigins)
    || !Array.isArray(block.segments) || p.segmentOrigins.length !== block.segments.length
    || ['work', 'edition', 'bodyHash'].some(key => key in p)) throw new Error('Invalid local literal provenance');
  const userSegments = [], sourceTexts = new Map(), order = [], sourceCounts = new Map();
  for (let i = 0; i < block.segments.length; ++i) {
    const origin = p.segmentOrigins[i], segment = block.segments[i];
    if (origin.segmentIndex !== i || typeof segment.text !== 'string') throw new Error('Unbound local segment');
    if (origin.origin === 'user-provided') {
      if (origin.inputHash !== hash || origin.field !== field) throw new Error('Wrong local segment input');
      userSegments.push(segment.text);
      if (order.at(-1) !== 'user') order.push('user');
    } else if (origin.origin === 'source') {
      const index = p.sourcePieces.findIndex(range => JSON.stringify(range) === JSON.stringify(origin.sourceRange));
      if (index < 0) throw new Error('Unbound local source segment');
      if (origin.rangeSegmentIndex !== (sourceCounts.get(index) || 0)) throw new Error('Wrong local source segment order');
      sourceCounts.set(index, (sourceCounts.get(index) || 0) + 1);
      sourceTexts.set(index, (sourceTexts.get(index) || '') + segment.text);
      if (order.at(-1) !== 'source:' + index) order.push('source:' + index);
    } else throw new Error('Unknown local segment origin');
  }
  if (userSegments.length !== 1 || userSegments[0] !== literal) throw new Error('Local literal changed');
  for (let i = 0; i < p.sourcePieces.length; ++i) {
    const piece = p.sourcePieces[i], text = sourceTexts.get(i);
    if (!text || [...text].length !== piece.length || piece.sourceBlockHash !== frame.sourceRange.sourceBlockHash
      || await textHash(text) !== piece.textSha256) throw new Error('Local source words changed');
  }
  if (mode === 'literal-only') {
    if (p.sourcePieces.length || block.segments.length !== 1) throw new Error('Unexpected literal-only source frame');
  } else {
    if (mode !== 'framed-marker') throw new Error('Unknown source/user frame mode');
    const marker = frame.markerRange, whole = frame.sourceRange;
    const candidates = markerCandidates;
    let originalMarker;
    for (const value of candidates) if (await textHash(value) === marker.textSha256) originalMarker = value;
    if (!originalMarker || marker.length !== [...originalMarker].length || whole.start !== 0) throw new Error('Unknown local source marker');
    const prefix = p.sourcePieces.findIndex(range => range.start === 0 && range.length === marker.start);
    const suffix = p.sourcePieces.findIndex(range => range.start === marker.start + marker.length && range.length === whole.length - marker.start - marker.length);
    if ((marker.start && prefix < 0) || suffix < 0 || p.sourcePieces.length !== (marker.start ? 2 : 1)
      || JSON.stringify(order) !== JSON.stringify([...(marker.start ? ['source:' + prefix] : []), 'user', 'source:' + suffix])
      || await textHash((marker.start ? sourceTexts.get(prefix) : '') + originalMarker + sourceTexts.get(suffix)) !== whole.textSha256) throw new Error('Local source frame changed');
  }
}
