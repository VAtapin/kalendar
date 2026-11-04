import{validLocalLiteral}from'./worship-local-context.js';
import{validWorshipDate}from'./worship-context.js';
const roles=['primate','diocesan','celebrant','deacon','rector','communicant'];
const cases=['nominative','genitive','dative','accusative','instrumental','locative'];
const keys=(v,allowed,required=allowed)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const forms=v=>{if(!keys(v,cases,[])||!Object.keys(v).length)throw Error('Explicit prepared name forms required');const result={};for(const k of cases)if(Object.hasOwn(v,k)){if(!validLocalLiteral(v[k]))throw Error('Invalid prepared literal');result[k]=v[k];}return result;};
export function normalizePreparedLiturgyContext(input,temple){
 if(!keys(input,['schemaVersion','templeProfileId','confirmedLiteralForms','people','commemorations'],['schemaVersion','templeProfileId','confirmedLiteralForms','people'])
   ||input.schemaVersion!==1||input.templeProfileId!==temple||input.confirmedLiteralForms!==true||!keys(input.people,roles,[]))throw Error('Invalid prepared local context');
 const people={};for(const role of roles)if(Object.hasOwn(input.people,role)){
  const p=input.people[role],hierarch=['primate','diocesan'].includes(role);
  if(!keys(p,hierarch?['rank','forms']:['forms'])||(hierarch&&!['patriarch','metropolitan','archbishop','bishop'].includes(p.rank)))throw Error('Invalid prepared person rank');
  people[role]={...(hierarch?{rank:p.rank}:{}),forms:forms(p.forms)};
 }
 const supplied=input.commemorations??{};if(!keys(supplied,['living','departed'],[]))throw Error('Invalid prepared commemoration lists');
 const commemorations={};for(const kind of ['living','departed']){
  const list=supplied[kind]??[];if(!Array.isArray(list)||list.length>64)throw Error('Invalid prepared commemoration count');
  commemorations[kind]=list.map(p=>{if(!keys(p,['forms']))throw Error('Invalid prepared list person');return{forms:forms(p.forms)};});
 }
 return{schemaVersion:1,templeProfileId:temple,confirmedLiteralForms:true,people,commemorations};
}
export function validatePreparedChoices(input){
 if(!keys(input,['schemaVersion','private','variant','building','locality','country','preparedGarments','censingTripletRepeats','deaconCommemorations','priestCommemorations','localForms','dismissalSaints','manyYearsProfile','confirmedLiteralForms','anaphoraSaint'],['schemaVersion','private','variant','building','locality'])
   ||input.schemaVersion!==1||input.private!==true||input.variant!=='prepared-priest-and-deacon'||!['temple','monastery'].includes(input.building)
   ||!['city','village','monastery'].includes(input.locality)||(input.building==='monastery')!==(input.locality==='monastery'))throw Error('Explicit prepared source choices required');
 if(Object.hasOwn(input,'country')&&input.country!=='printed-russian')throw Error('Unknown printed country variant');
 if(Object.hasOwn(input,'manyYearsProfile')&&!['russian-parish-metropolitan','russian-parish-archbishop','russian-parish-bishop'].includes(input.manyYearsProfile))throw Error('Unknown printed many-years variant');
 for(const key of ['deaconCommemorations','priestCommemorations'])if(Object.hasOwn(input,key)&&!['none','use-lists'].includes(input[key]))throw Error('Unknown commemoration choice');
 if(Object.hasOwn(input,'censingTripletRepeats')&&(!Number.isInteger(input.censingTripletRepeats)||input.censingTripletRepeats<1||input.censingTripletRepeats>12))throw Error('Invalid explicit censing count');
 if(Object.hasOwn(input,'preparedGarments')&&(!Array.isArray(input.preparedGarments)||!input.preparedGarments.length||input.preparedGarments.length>16||new Set(input.preparedGarments).size!==input.preparedGarments.length||input.preparedGarments.some(g=>typeof g!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(g))))throw Error('Invalid explicit garments');
 if(Object.hasOwn(input,'localForms')){if(input.confirmedLiteralForms!==true||!keys(input.localForms,['diocesanTerritoryGenitive'],[]))throw Error('Unconfirmed local source forms');for(const v of Object.values(input.localForms))if(!validLocalLiteral(v))throw Error('Invalid local territory literal');}
 for(const field of ['anaphoraSaint','dismissalSaints'])if(Object.hasOwn(input,field)){
  if(input.confirmedLiteralForms!==true)throw Error('Unconfirmed source saint forms');
  const lists=field==='anaphoraSaint'?[[input[field]]]:(keys(input[field],['temple','day'])?Object.values(input[field]):null);
  if(!lists||lists.some(list=>!Array.isArray(list)||list.length>16||list.some(s=>!keys(s,['identityId','genitive'])||typeof s.identityId!=='string'||!/^memory-day-\d{4}$/.test(s.identityId)||!validLocalLiteral(s.genitive))))throw Error('Invalid explicitly supplied saint identity/form');
 }
 return structuredClone(input);
}
export function buildPreparedPresanctifiedPost(state,publicVersion,input,choices){
 if(state.office!=='liturgy'||state.rite!=='presanctified'||!validWorshipDate(state.date)||!['auto','cu',undefined].includes(state.textLanguage)
   ||!['before-mid-lent-wednesday','from-mid-lent-wednesday'].includes(state.midLentBranch)||!/^[a-f0-9]{64}$/.test(publicVersion||''))throw Error('Invalid prepared Presanctified selection');
 normalizePreparedLiturgyContext(input,state.temple);validatePreparedChoices(choices);
 return{language:'cu',mode:'fixed',rite:'presanctified',date:state.date,midLentBranch:state.midLentBranch,templateVersion:publicVersion,
   sourceBodyVersion:'0'.repeat(64),temple:state.temple,localContext:structuredClone(input),preparedSourceChoices:structuredClone(choices)};
}
