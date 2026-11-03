export const MIDNIGHT_PROFILES={reader:'Чтение без священника',clergy:'Со священником'};
export const MIDNIGHT_LOCATIONS={church:'В храме',cell:'В келии'};
export const MIDNIGHT_BISHOP_TITLES={bishop:'Епископ',archbishop:'Архиепископ',metropolitan:'Митрополит'};
export const MIDNIGHT_URL_KEYS=['midnightProfile','midnightLocation','midnightBishopTitle'];
export function readMidnightSelection(params,state){
  for(const[key,options,fallback]of [['midnightProfile',MIDNIGHT_PROFILES,'reader'],['midnightLocation',MIDNIGHT_LOCATIONS,'church'],['midnightBishopTitle',MIDNIGHT_BISHOP_TITLES,'bishop']])
    state[key]=Object.hasOwn(options,params.get(key))?params.get(key):fallback;
}

import { validWorshipDate, worshipRequestSignal } from './worship-context.js';
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function midnightTypedParams(state) {
  if (state.office !== 'midnight-office' || !validWorshipDate(state.date) || !['auto','cu',undefined].includes(state.textLanguage)
    || !['standalone','default'].includes(state.sequence) || typeof state.temple!=='string'||!/^[a-z0-9-]{1,100}$/.test(state.temple)) throw Error('Invalid Midnight selection');
  const profile = state.midnightProfile || 'reader', location = state.midnightLocation || 'church';
  if (!['reader','clergy'].includes(profile)) throw Error('Invalid Midnight profile');
  if (!['church','cell'].includes(location)) throw Error('Invalid Midnight location');
  const input={ date:state.date,temple:state.temple,language:'cu',profile,location,sequence:state.sequence,calendarStyle:'julian' };
  if(profile==='clergy'){
    if(!['bishop','archbishop','metropolitan'].includes(state.midnightBishopTitle))throw Error('Explicit Midnight bishop title required');
    if(state.midnightBishopTitle!=='bishop')input.bishopTitle=state.midnightBishopTitle;
  }
  return input;
}
export function midnightParams(state) {
  const input=midnightTypedParams(state);
  if(input.profile!=='reader')throw Error('Clergy full GET cannot contain private names');
  return input;
}
export function validateMidnightFull(body,state) {
  const params=midnightParams(state),data=body?.data,c=data?.context;
  const flags=['wholeOfficeAccepted','runtimeAdmissionGranted','calendarServiceAppointed'];
  const prepared=flags.every(key=>data?.[key]===true)
    && data.preparedServiceScope==='calculated-ordinary-standalone-source-variant'
    && Array.isArray(data.appointmentAssumptions)&&data.appointmentAssumptions.length===1&&data.appointmentAssumptions[0]==='no-local-vigil-or-proper-override'
    && data.actualVigilScheduleVerified===false;
  if (data?.schemaVersion!==1||data.office!=='midnight-office'||data.status!=='complete'||data.date!==params.date
    || !c || c.office!=='midnight-office' || Object.entries(params).some(([key,value])=>c[key]!==value) || !digest(data.templateVersion)||!digest(data.calendarHash)
    || data.sourceClass!=='ordinary-standalone-no-vigil'
    || !prepared||data.actualLocalContextVerified!==false
    || data.performance!==null || !Array.isArray(data.blocks)||!data.blocks.length) throw Error('Invalid Midnight full contract');
  validateMidnightReaderBlocks(data.blocks);
  // UI completeness refers to the selected text only. Preserve all API admission flags.
  return {status:'ready',language:'cu',midnightPrepared:prepared,data};
}
export function validateMidnightNativeBlocks(blocks,profile='reader'){
  if(!Array.isArray(blocks)||!blocks.length)throw Error('Missing Midnight reader blocks');
  const ids=new Set();
  for(const block of blocks){
    const p=block?.provenance;
    if(!Array.isArray(block?.segments)||!block.segments.length||block.segments.some(s=>typeof s.text!=='string')
      ||!(profile==='reader'?block.role==='reader':['priest','assembly','presider','brethren','rubric'].includes(block.role))||typeof block.kind!=='string'||typeof block.occurrenceId!=='string'||ids.has(block.occurrenceId)
      ||!Number.isInteger(block.repeatCount)||block.repeatCount<1||block.repeatCount>100||!Number.isInteger(block.repeatIndex)||block.repeatIndex<1||block.repeatIndex>block.repeatCount
      ||p?.userSupplied===true||p?.runtimeLiteralProof!==true||typeof p.canonicalWork!=='string'||typeof p.canonicalEdition!=='string'
      ||!digest(p.canonicalBodyHash)||!digest(p.canonicalSourceHash)||!Number.isInteger(p.canonicalBlock)||p.canonicalBlock<0
      ||!Array.isArray(p.canonicalSelectionSteps)||!p.canonicalSelectionSteps.length||p.canonicalSelectionSteps.some(step=>!Number.isInteger(step.start)||step.start<0||!Number.isInteger(step.length)||step.length<1||!digest(step.sourceBlockHash)||!digest(step.textSha256)))
      throw Error('Invalid Midnight reader source block');
    ids.add(block.occurrenceId);
  }
  return blocks;
}
export function validateMidnightReaderBlocks(blocks){return validateMidnightNativeBlocks(blocks,'reader');}
export async function fetchMidnightFull(base,state,fetcher=fetch,signal){
  const params=midnightTypedParams(state),url=new URL('/api/v1/liturgical/services/midnight-office',base),requestSignal=worshipRequestSignal(signal);
  url.search=new URLSearchParams(params);
  requestSignal.throwIfAborted();
  const response=await fetcher(url,{credentials:'omit',cache:'no-store',headers:{Accept:'application/json'},signal:requestSignal});
  const cache=response.headers?.get('cache-control')||'';
  if(!cache.includes('private')||!cache.includes('no-store'))throw Error('Invalid Midnight cache policy');
  if(response.status===404)return{status:'unavailable'};
  if(response.status===409){const value=await response.json();if(value?.data?.status==='partial'&&!value.data.blocks)return{status:'pending'};throw Error('Invalid Midnight held response');}
  if(response.status!==200)throw Error('Midnight text unavailable: '+response.status);
  return validateMidnightFull(await response.json(),state);
}
