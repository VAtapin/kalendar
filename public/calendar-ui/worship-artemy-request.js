import { validLocalLiteral } from './worship-local-context.js';
import { normalizePreparedLiturgyContext } from './worship-presanctified-prepared-context.js';
const required={primate:['locative','accusative'],diocesan:['locative','accusative'],celebrant:['dative','nominative'],deacon:['nominative'],communicant:['nominative']};
export function isArtemyContext(state){
 return state.office==='liturgy'&&state.rite==='john-chrysostom'&&['2026-11-02','2027-11-02'].includes(state.date)&&state.temple==='george-victorious'&&['auto','cu',undefined].includes(state.textLanguage)&&['auto',undefined].includes(state.officeMode);
}
export function buildArtemyPost(state,version,localContext,manyYearsContext){
 if(!isArtemyContext(state)||!/^[a-f0-9]{64}$/.test(version||''))throw Error('Unsupported printed Liturgy context');
 const normalized=normalizePreparedLiturgyContext(localContext,state.temple);
 if(normalized.commemorations.living.length||normalized.commemorations.departed.length)throw Error('Unsupported commemoration lists');
 if(!Object.hasOwn(localContext,'people')||!Object.hasOwn(manyYearsContext||{},'confirmedLiteralForm'))throw Error('Explicit private input required');
 if(Object.keys(normalized.people).length!==Object.keys(required).length||normalized.people.primate?.rank!=='patriarch'||normalized.people.diocesan?.rank!=='metropolitan')throw Error('Explicit source ranks required');
 for(const [role,cases] of Object.entries(required))if(!normalized.people[role]||cases.some(k=>!normalized.people[role].forms[k])||Object.keys(normalized.people[role].forms).length!==cases.length)throw Error('Explicit source name cases required');
 if(!manyYearsContext||typeof manyYearsContext!=='object'||Array.isArray(manyYearsContext)||Object.keys(manyYearsContext).length!==2||manyYearsContext.confirmedLiteralForm!==true||!validLocalLiteral(manyYearsContext.diocesanTitledAccusative))throw Error('Explicit many-years form required');
 return{language:'cu',mode:'fixed',rite:'john-chrysostom',date:state.date,temple:state.temple,officeMode:'auto',templateVersion:version,localContext:structuredClone(localContext),manyYearsContext:structuredClone(manyYearsContext)};
}
