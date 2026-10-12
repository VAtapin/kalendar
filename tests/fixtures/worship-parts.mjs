import { createHash } from 'node:crypto';
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const block = (text, kind = 'text') => ({ kind, segments: [{ text, style: kind === 'heading' ? 'rubric' : 'text' }] });
export function templateFor(office) {
  const outline = office === 'liturgy';
  return { schemaVersion: 1, artifactType: outline ? 'source-bound-template' : 'fixed-template', status: outline ? 'source-outline' : 'fixed-complete',
    templateId: office + ':fixture', templateVersion: 'a'.repeat(64), ruleVersion: 'fixture-v1',
    dateDependent: false, appointedForDate: false, language: 'cu-civil', orthography: 'civil',
    ...(outline ? { cleanTemplate: false, compositionReady: false } : {}),
    profile: { office }, sourceVersions: [{ work: 'fixture-fixed-source', language: 'cu-civil', orthography: 'civil' }],
    nodes: [
      { nodeId: 'opening', kind: outline ? 'source-block' : 'fixed', language: 'cu-civil', blocks: [
        block(office, 'heading'), { kind: 'text', segments: [{ text: 'Священник: ', style: 'rubric' }, { text: 'Благослове́н Бог наш. <script>unsafe</script>', style: 'text' }] },
        block('Го́споди, поми́луй.'), block('Го́споди, поми́луй.'),
      ] },
      { nodeId: 'leading', kind: 'slot', slotId: 'troparion-of-day:leading', required: false },
      { nodeId: 'last', kind: 'slot', slotId: 'troparion-of-day:last', required: true },
      { nodeId: 'kontakion', kind: 'slot', slotId: 'kontakion-of-day', required: true },
      { nodeId: 'optional', kind: 'fixed', language: 'cu-civil', blocks: [block('Необязательное окончание')] },
    ] };
}
export function assignmentsFor(template, state, complete = true) {
  const context = { ...state, language: 'cu-civil', calendarStyle: 'julian' };
  const removeOptional = (state.office === 'first-hour' && state.afterHourHymn === 'none')
    || (state.office === 'ninth-hour' && state.sequence === 'before-vespers' && state.location === 'nave');
  const troparion = block('Тропарь ' + state.date), kontakion = block('Кондак ' + state.date);
  const operations = !complete ? [] : [
    { type: 'remove', nodeId: 'leading', slotId: 'troparion-of-day:leading', reason: 'single-troparion' },
    { type: 'fill', nodeId: 'last', slotId: 'troparion-of-day:last', blocks: [troparion], blockSources: [{ language: 'cu-civil', orthography: 'civil' }] },
    { type: 'fill', nodeId: 'kontakion', slotId: 'kontakion-of-day', blocks: [kontakion], blockSources: [{ language: 'cu-civil', orthography: 'civil' }] },
  ];
  if (removeOptional) operations.push({ type: 'remove', nodeId: 'optional', reason: 'explicit-profile' });
  return { schemaVersion: 1, artifactType: state.office === 'liturgy' ? 'liturgy-assignments' : 'hour-assignments',
    templateId: template.templateId, templateVersion: template.templateVersion, ruleVersion: template.ruleVersion,
    templateSourcesHash: hash(template.sourceVersions), context, status: complete ? 'complete' : 'partial',
    completeness: { appointment: complete, composition: complete }, operations,
    missing: complete ? [] : template.nodes.filter(node => node.kind === 'slot').map(node => ({ nodeId: node.nodeId, slotId: node.slotId, reason: 'not-verified' })),
    composedBlocksHash: complete ? hash([...template.nodes[0].blocks, troparion, kontakion, ...(!removeOptional ? template.nodes.at(-1).blocks : [])]) : null,
  };
}
