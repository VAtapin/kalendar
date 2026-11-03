import { partsHash } from './worship-hash.js';
import { worshipRequestSignal } from './worship-context.js';
import { midnightParams, midnightTypedParams, validateMidnightNativeBlocks, validateMidnightReaderBlocks } from './worship-midnight-context.js';
import { normalizeMidnightClergyContext, buildMidnightClergyPost } from './worship-local-context.js';
const MATERIAL='d0fc075a512cb8b7881d4d64fde43545ab25190164ca8564eca20e810adb4e51';
const RULES='ab431b34ecfd2028f516bab274bb99d91b86b05d89682f9ca330632a1007563f';
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export async function validateMidnightTemplate(body,state){
  const input=midnightTypedParams(state),t=body?.data;
  if(t?.schemaVersion!==1||t.office!=='midnight-office'||t.profile!==input.profile||t.ruleVersion!==RULES
    ||typeof t.variant!=='string'||!/^(weekday-ordinary-(winter|summer)|saturday-(church|cell)|sunday-tone-[1-8])$/.test(t.variant)||t.templateId!=='midnight-office:cu:'+t.variant+':'+input.profile
    ||t.sourceClass!=='ordinary-standalone-no-vigil'||!hash(t.templateVersion)
    ||['wholeOfficeAccepted','runtimeAdmissionGranted','calendarServiceAppointed','actualLocalContextVerified'].some(key=>t[key]!==false)
    ||!Array.isArray(t.sourceVersions)||!t.sourceVersions.length||!Array.isArray(t.nodes)||!t.nodes.length)throw Error('Invalid typed Midnight reader template');
  if(t.sourceVersions.some(s=>typeof s.work!=='string'||typeof s.edition!=='string'||s.language!=='cu'||!hash(s.hash)||!hash(s.sourceHash)))throw Error('Invalid Midnight sources');
  const ids=new Set(),slots=[];
  for(const [index,node]of t.nodes.entries()){
    if(node.nodeId!=='midnight:'+index||ids.has(node.nodeId)||!['fixed','slot'].includes(node.kind))throw Error('Invalid Midnight template node');
    ids.add(node.nodeId);
    if(node.kind==='slot'){
      if(input.profile!=='clergy'||!['local.patriarch-dative','local.bishop-dative','local.superior-dative'].includes(node.slotId)||!Array.isArray(node.blocks)||node.blocks.length)throw Error('Unverified Midnight input slot');
      slots.push(node.slotId);continue;
    }
    validateMidnightNativeBlocks(node.blocks,input.profile);
    for(const b of node.blocks){const p=b.provenance;if(!t.sourceVersions.some(s=>s.work===p.canonicalWork&&s.edition===p.canonicalEdition&&s.hash===p.canonicalBodyHash&&s.sourceHash===p.canonicalSourceHash))throw Error('Unbound canonical block');}
  }
  validateMidnightNativeBlocks(t.nodes.flatMap(n=>n.blocks),input.profile);
  if(input.profile==='clergy'&&JSON.stringify(slots)!==JSON.stringify(['local.patriarch-dative','local.bishop-dative','local.superior-dative']))throw Error('Invalid Midnight local field order');
  if(await partsHash([MATERIAL,RULES,t.sourceVersions,t.variant,input.profile,input.bishopTitle||'bishop'])!==t.templateVersion)throw Error('Midnight template version mismatch');
  return t;
}
export async function validateMidnightReaderTemplate(body,state){midnightParams(state);return validateMidnightTemplate(body,state);}
export async function composeMidnightReader(templateBody,assignmentBody,state,actualRequestQuery){
  const input=midnightParams(state),t=await validateMidnightReaderTemplate(templateBody,state),a=assignmentBody?.data;
  if(!a||Object.entries(input).some(([key,value])=>actualRequestQuery?.[key]!==value)
    ||Object.keys(actualRequestQuery).some(key=>!Object.hasOwn(input,key)&&key!=='templateVersion')
    ||actualRequestQuery.templateVersion!==t.templateVersion)throw Error('Actual reader request mismatch');
  if(['schemaVersion','templateId','templateVersion','ruleVersion'].some(key=>a[key]!==t[key])||a.date!==input.date||!hash(a.calendarHash)
    ||a.templateSourcesHash!==await partsHash(t.sourceVersions)||a.inputHash!==await partsHash(actualRequestQuery)
    ||a.localContextBindingHash!==await partsHash([])||a.performance!==null||!Array.isArray(a.operations)||a.operations.length
    ||!Array.isArray(a.missing)||a.missing.length||a.status!=='complete'
    ||['wholeOfficeAccepted','runtimeAdmissionGranted','calendarServiceAppointed'].some(key=>a[key]!==true)
    ||a.preparedServiceScope!=='calculated-ordinary-standalone-source-variant'||a.actualVigilScheduleVerified!==false||a.actualLocalContextVerified!==false
    ||!Array.isArray(a.appointmentAssumptions)||a.appointmentAssumptions.length!==1||a.appointmentAssumptions[0]!=='no-local-vigil-or-proper-override')throw Error('Midnight reader assignment not verified complete');
  const blocks=t.nodes.flatMap(n=>n.blocks);validateMidnightReaderBlocks(blocks);
  if(!hash(a.composedBlocksHash)||a.composedBlocksHash!==await partsHash(blocks))throw Error('Midnight reader composition hash mismatch');
  // This is a UI model composed from typed modular replies, never an invented HTTP body.
  return{status:'parts',template:t,entries:t.nodes.map(n=>({...n,language:'cu'})),sourceVersions:t.sourceVersions,
    assignmentsStatus:'complete',complete:true,midnightPrepared:true,midnightContract:a};
}

const targets = { 'local.patriarch-dative': 'primate', 'local.bishop-dative': 'diocesan', 'local.superior-dative': 'rector' };
const digest = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const same = async (a,b) => await partsHash(a) === await partsHash(b);
export async function validateMidnightPerformance(performance,template,blocks){
  if(!performance||performance.count!==null||performance.numericFrequencyClaim!==false)throw Error('Invalid dynamic Midnight frequency');
  const { startBeforeOccurrenceId,stopBeforeOccurrenceId,...frozen }=performance;
  const expected=template.variant.startsWith('sunday-')?'15354e56403d58ef4f64a9b4615a4695f3991b13fcbc326b2d47af17be777862':'998ed8299977c7008b3bdc3dd441a967a764a068e3fac13918ec5ca34d459bfe';
  if(await partsHash(frozen)!==expected)throw Error('Changed Midnight performance source/rubric');
  const start=blocks.filter(b=>b.occurrenceId===startBeforeOccurrenceId),stop=blocks.filter(b=>b.occurrenceId===stopBeforeOccurrenceId);
  if(start.length!==1||stop.length!==1||blocks.indexOf(start[0])>=blocks.indexOf(stop[0])
    ||start[0].provenance.endingReference!==performance.startBeforeReference||stop[0].provenance.endingReference!==performance.stopBeforeReference)throw Error('Invalid Midnight response anchors');
  return performance;
}
export async function composeMidnightClergy(templateBody,assignmentBody,state,actualInput,{privatePost=false,printedVariantConfirmed=false,fullEvaluation=false}={}){
  const input=midnightTypedParams(state),t=await validateMidnightTemplate(templateBody,state),a=assignmentBody?.data;
  if(input.profile!=='clergy'||!a)throw Error('Explicit clergy contract required');
  if(!actualInput||Object.entries(input).some(([key,value])=>actualInput[key]!==value&&!(key==='bishopTitle'&&value==='bishop'&&actualInput[key]===undefined))
    ||Object.keys(actualInput).some(key=>!Object.hasOwn(input,key)&&!['templateVersion',...(privatePost?['localContext','sourceVariantId']:[])].includes(key))
    ||(actualInput.templateVersion!==t.templateVersion&&!(fullEvaluation&&!privatePost&&actualInput.templateVersion===undefined)))throw Error('Midnight request context mismatch');
  let local=null;
  if(privatePost){
    local=normalizeMidnightClergyContext(state,actualInput?.localContext);
    // The capture's exact raw order/default omissions remain bound by inputHash below.
    buildMidnightClergyPost(state,local,t.templateVersion,printedVariantConfirmed);
    if(actualInput.sourceVariantId!=='printed-russian-patriarch-and-superior')throw Error('Private Midnight request mismatch');
  }
  if(['schemaVersion','templateId','templateVersion','ruleVersion'].some(k=>a[k]!==t[k])||a.date!==input.date||!digest(a.calendarHash)
    ||a.templateSourcesHash!==await partsHash(t.sourceVersions)||a.inputHash!==await partsHash(actualInput)
    ||a.localContextBindingHash!==await partsHash(local||[])||!Array.isArray(a.operations)||!Array.isArray(a.missing)
    ||a.preparedServiceScope!=='calculated-ordinary-standalone-source-variant'||a.actualVigilScheduleVerified!==false||a.actualLocalContextVerified!==false
    ||!await same(a.appointmentAssumptions,['no-local-vigil-or-proper-override']))throw Error('Invalid Midnight clergy assignments');
  const filled=new Map(),missing=[];
  for(const node of t.nodes){
    if(node.kind!=='slot')continue;
    const role=targets[node.slotId],literal=local?.people[role]?.forms.dative;
    if(literal===undefined){missing.push({code:'local-literal-form-required',reference:role+'.dative'});continue;}
    const matches=a.operations.filter(op=>op.nodeId===node.nodeId);if(matches.length!==1)throw Error('Missing or duplicate private Midnight fill');
    const op=matches[0],block=op.blocks?.[0],p=block?.provenance,index=t.nodes.indexOf(node);
    if(op.type!=='fill'||op.slotId!==node.slotId||!Array.isArray(op.blocks)||op.blocks.length!==1
      ||block.kind!=='text'||block.role!=='priest'||block.slot!==node.slotId||block.repeatCount!==1||block.repeatIndex!==1
      ||block.occurrenceId!==t.variant+'-'+(input.bishopTitle||'bishop')+'-church-bound:'+index+':0:0'
      ||!await same(block.segments,[{text:literal,style:'text'}])
      ||!await same(p,{userSupplied:true,sourceAttested:false,authorityAttested:false,personRole:role,grammaticalCase:'dative'}))throw Error('Invalid private Midnight literal binding');
    filled.set(node.nodeId,op);
  }
  const complete=missing.length===0;
  if(a.operations.length!==filled.size||!await same(a.missing,missing)||a.status!==(complete?'complete':'partial')
    ||a.wholeOfficeAccepted!==complete||a.runtimeAdmissionGranted!==complete||a.calendarServiceAppointed!==true)throw Error('Wrong Midnight completeness or missing forms');
  const entries=t.nodes.map(node=>node.kind==='fixed'?{...node,language:'cu'}:filled.has(node.nodeId)
    ?{...node,kind:'fixed',blocks:filled.get(node.nodeId).blocks,language:'cu',userProvided:true}
    :{...node,missing:true,reason:'traditional-cu-verified-local-context-required',contract:{category:'local'}});
  const blocks=entries.flatMap(e=>e.blocks||[]),ids=new Set();
  validateMidnightNativeBlocks(blocks.filter(b=>!b.provenance?.userSupplied),'clergy');
  for(const block of blocks){if(ids.has(block.occurrenceId))throw Error('Duplicate Midnight occurrence');ids.add(block.occurrenceId);}
  if(!digest(a.composedBlocksHash)||a.composedBlocksHash!==await partsHash(blocks))throw Error('Midnight clergy composition digest mismatch');
  const performance=await validateMidnightPerformance(a.performance,t,blocks);
  return{status:'parts',template:t,entries,sourceVersions:t.sourceVersions,assignmentsStatus:a.status,complete,
    midnightPrepared:complete,midnightClergy:true,localContextAvailable:true,localValuesApplied:filled.size>0,
    localFilledCount:filled.size,midnightContract:a,performance};
}

export async function fetchMidnightParts(base,state,onBase=()=>{},fetcher=fetch,signal,options={}){
  state={...state};const input=midnightTypedParams(state),requestSignal=worshipRequestSignal(signal);
  async function request(resource,params,body){
    requestSignal.throwIfAborted();const url=new URL('/api/v1/liturgical/'+resource+'/midnight-office',base);
    if(!body)url.search=new URLSearchParams(params);
    const response=await fetcher(url,{credentials:'omit',cache:'no-store',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{method:'POST',body:JSON.stringify(body)}:{}),signal:requestSignal});
    const policy=response.headers?.get('cache-control')||'';
    if(!policy.includes('private')||!policy.includes('no-store'))throw Error('Invalid Midnight cache policy');
    if(response.status!==200)throw Object.assign(Error('Midnight request failed'),{status:response.status});
    return response.json();
  }
  let templateBody;
  try{templateBody=await request('templates',input);}catch(error){
    requestSignal.throwIfAborted();if(error.status===404)return{status:'unavailable'};if(error.status===409)return{status:'pending'};throw error;
  }
  const template=await validateMidnightTemplate(templateBody,state);
  const baseline={status:'parts',template,entries:template.nodes.map(node=>node.kind==='slot'
    ?{...node,missing:true,reason:'traditional-cu-verified-local-context-required',contract:{category:'local'}}:{...node,language:'cu'}),
    sourceVersions:template.sourceVersions,complete:false,assignmentsStatus:'loading',midnightClergy:input.profile==='clergy',localContextAvailable:false};
  requestSignal.throwIfAborted();onBase(baseline);
  const privatePost=options.localContext!==undefined;
  const actualInput=privatePost?buildMidnightClergyPost(state,options.localContext,template.templateVersion,options.printedVariantConfirmed).body:{...input,templateVersion:template.templateVersion};
  try{
    const body=await request('assignments',actualInput,privatePost?actualInput:undefined);
    return input.profile==='reader'?await composeMidnightReader(templateBody,body,state,actualInput)
      :await composeMidnightClergy(templateBody,body,state,actualInput,{privatePost,printedVariantConfirmed:options.printedVariantConfirmed});
  }catch(error){requestSignal.throwIfAborted();if(privatePost)throw error;return{...baseline,assignmentsStatus:'error'};}
}
