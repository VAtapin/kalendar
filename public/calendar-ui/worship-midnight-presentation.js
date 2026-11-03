// Paragraph layout only. Original typed entries, native blocks and composition hashes stay intact.
export function midnightPresentationEntries(result){
  if(!result.midnightClergy||!result.complete)return result.entries;
  const entries=result.entries,blocks=entries.flatMap(e=>e.blocks||[]);
  const start=blocks.findIndex(b=>b.occurrenceId===result.performance.startBeforeOccurrenceId);
  const stop=blocks.findIndex(b=>b.occurrenceId===result.performance.stopBeforeOccurrenceId);
  const country=blocks.findIndex((b,i)=>i>start&&i<stop&&b.provenance?.endingReference==='country');
  if(start<0||country<=start||stop<=country)throw Error('Midnight paragraph boundaries missing');
  const ranges=[[start,country],[country,stop]],groups=new Map(),skip=new Set();
  for(const[from,to]of ranges){
    const selected=blocks.slice(from,to);
    if(selected.some(b=>b.role!=='priest'||b.repeatCount!==1||b.repeatIndex!==1))throw Error('Midnight paragraph profile mismatch');
    const segments=[];
    for(const block of selected){
      const previous=segments.at(-1)?.text||'',next=block.segments[0]?.text||'';
      // A paragraph boundary supplied whitespace before joining. Keep a visible separator between its words.
      if(previous&&next&&!/\s$/u.test(previous)&&!/^\s|^[,.;:!?…]/u.test(next))segments.push({text:' ',style:'text'});
      segments.push(...block.segments);
    }
    groups.set(selected[0].occurrenceId,{kind:'text',role:'priest',segments,
      occurrenceId:selected[0].occurrenceId,repeatCount:1,repeatIndex:1,presentationOnly:true});
    for(const block of selected.slice(1))skip.add(block.occurrenceId);
  }
  return entries.flatMap(entry=>{
    const display=entry.blocks.filter(b=>!skip.has(b.occurrenceId)).map(b=>groups.get(b.occurrenceId)||b);
    return display.length?[{...entry,blocks:display}]:[];
  });
}
