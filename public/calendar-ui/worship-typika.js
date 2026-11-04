// Typed source consumer; never infer absence of Liturgy or grant whole-office admission.
import {partsHash}from'./worship-hash.js';
import {validWorshipDate}from'./worship-context.js';
import {worshipRequestSignal}from'./worship-context.js';
export const TYPIKA_VARIANT='horologion-twelve-mercy-lord-temple-single-minea';
export const TYPIKA_VARIANTS={[TYPIKA_VARIANT]:'По Часослову: 12 «Господи, помилуй»'};
export const TYPIKA_URL_KEYS=['typikaVariant','typikaNoLiturgy'];
export function readTypikaSelection(params,state){state.typikaVariant=params.get('typikaVariant')||'';state.typikaNoLiturgy=params.get('typikaNoLiturgy')==='1';}
const choiceIdentity=s=>JSON.stringify([s.date,s.temple,s.textLanguage||'auto',s.typikaVariant]);
export function bindTypikaConfirmation(state){state.typikaConfirmedFor=state.typikaNoLiturgy===true?choiceIdentity(state):'';}
export function retainTypikaConfirmation(state){if(state.typikaNoLiturgy===true&&state.typikaConfirmedFor!==choiceIdentity(state))state.typikaNoLiturgy=false;}
const RULE='d440857898f4569d35c1dee20df4876d8a3a411217780b1ca4ef8e03f70e8f6d';
const falseFlags=['calendarRiteReplaced','calendarServiceAppointed','actualLocalContextVerified','runtimeAdmissionGranted','wholeOfficeAccepted'];
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const same=async(a,b)=>await partsHash(a)===await partsHash(b);
export function typikaParams(state){
 if(state.office!=='typika'||!validWorshipDate(state.date)||state.temple!=='transfiguration'||!['cu','auto',undefined].includes(state.textLanguage)
   ||state.typikaNoLiturgy!==true||state.typikaVariant!==TYPIKA_VARIANT)throw Error('Explicit Typika source variant and no-Liturgy choice required');
 return{date:state.date,language:'cu',calendarStyle:'julian',temple:state.temple,sourceVariantId:state.typikaVariant,typikaNoLiturgy:'1'};
}
function envelope(d,state){
 const c=d?.context;
 if(d?.schemaVersion!==1||c?.date!==state.date||c.office!=='typika'||c.language!=='cu'||c.temple!==state.temple||c.calendarStyle!=='julian'
   ||d.sourceVariantId!==TYPIKA_VARIANT||d.resultKind!=='conditional-service-sequence'||falseFlags.some(k=>d[k]!==false))throw Error('Unbound conditional Typika receipt');
}
function sourceBlock(b,sources){
 const p=b?.provenance;
 if(!b||!Array.isArray(b.segments)||!b.segments.length||b.segments.some(s=>typeof s.text!=='string')
   ||typeof b.occurrenceId!=='string'||!Number.isInteger(b.repeatCount)||b.repeatCount<1||!Number.isInteger(b.repeatIndex)||b.repeatIndex<1||b.repeatIndex>b.repeatCount
   ||p?.userSupplied===true||p?.language!=='cu'||!Number.isInteger(p.block)||p.block<0
   ||!sources.some(s=>s.work===p.work&&s.edition===p.edition&&s.hash===p.bodyHash&&s.sourceHash===p.sourceHash))throw Error('Unbound Typika native source block');
 if(p.range&&(!Number.isInteger(p.range.start)||p.range.start<0||!Number.isInteger(p.range.length)||p.range.length<1||!digest(p.range.sourceBlockHash)||!digest(p.range.textSha256)))throw Error('Changed Typika source range');
}
export async function composeTypika(templateBody,assignmentBody,state,fullBody){
 typikaParams(state);const t=templateBody?.data,a=assignmentBody?.data;
 envelope(t,state);envelope(a,state);
 if(t.templateId!=='typika:cu:ordinary-horologion'||t.ruleVersion!==RULE||!digest(t.templateVersion)
   ||!Array.isArray(t.sourceVersions)||!t.sourceVersions.length||t.sourceVersions.some(s=>s.language!=='cu'||!digest(s.hash)||!digest(s.sourceHash))
   ||!Array.isArray(t.nodes)||!t.nodes.length||a.status!=='complete'||a.missing?.length!==0
   ||!Array.isArray(a.operations)||a.operations.length!==t.nodes.length||a.templateSourcesHash!==await partsHash(t.sourceVersions)
   ||['schemaVersion','templateId','templateVersion','ruleVersion'].some(k=>t[k]!==a[k]))throw Error('Incompatible Typika template/assignments');
 const entries=[],seen=new Set(),occurrences=new Set();
 for(const[index,n]of t.nodes.entries()){
  const op=a.operations[index];
  if(n.nodeId!=='typika:'+index||n.kind!=='slot'||n.slotId!==n.nodeId||seen.has(n.nodeId)||op.type!=='fill'||op.nodeId!==n.nodeId||op.slotId!==n.slotId
    ||!Array.isArray(op.blocks)||!op.blocks.length)throw Error('Changed Typika source order/operation');
  seen.add(n.nodeId);
  for(const b of op.blocks){sourceBlock(b,t.sourceVersions);if(occurrences.has(b.occurrenceId))throw Error('Duplicate Typika occurrence');occurrences.add(b.occurrenceId);}
  entries.push({...n,kind:'fixed',language:'cu',blocks:op.blocks});
 }
 const blocks=entries.flatMap(e=>e.blocks);
 if(await partsHash(blocks)!==a.composedBlocksHash)throw Error('Changed Typika composed body');
 if(fullBody){const f=fullBody.data;envelope(f,state);
  if(f.status!=='complete'||f.templateVersion!==t.templateVersion||!await same(f.blocks,blocks)
    ||!await same(f.completeness,{text:true,appointment:true,review:false})||f.conditionalAppointment!=='explicitly-selected-local-no-Liturgy-source-rule')throw Error('Typika full/modular mismatch');
 }
 return{status:'parts',assignmentsStatus:'conditional',complete:false,conditionalPrepared:true,typikaPrepared:true,entries,template:t,sourceVersions:t.sourceVersions,
   sourceScope:'explicitly-selected-local-no-Liturgy-source-rule',serviceContract:{template:t,assignments:a}};
}
export async function fetchTypikaParts(base,state,fetcher=fetch,signal){
 if(state.typikaVariant!==TYPIKA_VARIANT||state.typikaNoLiturgy!==true||state.temple!=='transfiguration')return{status:'typika-context-required'};
 const params=typikaParams(state),requestSignal=worshipRequestSignal(signal);
 async function request(resource,query){
  requestSignal.throwIfAborted();const url=new URL('/api/v1/liturgical/'+resource+'/typika',base);url.search=new URLSearchParams(query);
  const response=await fetcher(url,{credentials:'omit',cache:'no-store',headers:{Accept:'application/json'},signal:requestSignal});
  requestSignal.throwIfAborted();const cache=response.headers?.get('cache-control')||'';
  if(!cache.includes('private')||!cache.includes('no-store'))throw Error('Invalid Typika cache policy');
  if(response.status===409)return null;if(response.status!==200)throw Error('Typika request failed');return response.json();
 }
 const template=await request('templates',params);if(!template)return{status:'typika-unavailable'};
 const assignments=await request('assignments',{...params,templateVersion:template.data?.templateVersion});
 if(!assignments)return{status:'typika-unavailable'};return composeTypika(template,assignments,state);
}
