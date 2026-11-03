// Synthetic input/schema tests, not actual POST fixtures or private fill evidence.
import {test}from'vitest';import assert from'node:assert/strict';
import{buildMidnightClergyPost}from'../public/calendar-ui/worship-local-context.js';
const state={office:'midnight-office',date:'2026-11-09',temple:'george-victorious',sequence:'standalone',textLanguage:'cu',midnightProfile:'clergy',midnightLocation:'church',midnightBishopTitle:'bishop'};
const input={schemaVersion:1,templeProfileId:state.temple,confirmedLiteralForms:true,people:{primate:{rank:'patriarch',forms:{dative:'Те́стовому'}},diocesan:{rank:'bishop',forms:{dative:'Тестовому'}},rector:{forms:{dative:'Те́стовому'}}}};
test('prepares an explicit private JSON POST without URL names, mutation or inferred forms',()=>{
  const before=JSON.stringify({state,input}),request=buildMidnightClergyPost(state,input,'a'.repeat(64),true);
  assert.deepEqual(request.query,{});assert.equal(request.method,'POST');assert.equal(request.cache,'no-store');assert.equal(request.credentials,'omit');
  assert.ok(!request.path.includes('Тест'));assert.equal(request.body.localContext.people.primate.forms.dative,'Те́стовому');
  assert.equal(JSON.stringify({state,input}),before);request.body.localContext.people.primate.forms.dative='Изменённому';assert.equal(input.people.primate.forms.dative,'Те́стовому');
});
test('partial explicit input stays partial data; missing people are not fabricated',()=>{
  const raw={...input,people:{rector:input.people.rector}};
  const request=buildMidnightClergyPost(state,raw,'a'.repeat(64),true);
  assert.deepEqual(Object.keys(request.body.localContext.people),['rector']);
});
const mutations={
  unconfirmed:i=>{i.confirmedLiteralForms=false;},wrongTemple:i=>{i.templeProfileId='nicholas';},
  inferredCase:i=>{i.people.rector.forms={nominative:'Тестовый'};},wrongPrimate:i=>{i.people.primate.rank='metropolitan';},
  wrongBishop:i=>{i.people.diocesan.rank='archbishop';},extraPerson:i=>{i.people.celebrant={forms:{dative:'Тестовому'}};},
  extraFields:i=>{i.people.rector.sourceAttested=true;},markup:i=>{i.people.rector.forms.dative='<b>Тестовому</b>';},
  whitespace:i=>{i.people.rector.forms.dative=' Тестовому';},placeHolder:i=>{i.people.rector.forms.dative='имярек';},
  extraCommemoration:i=>{i.commemorations={living:[{forms:{dative:'Тестовому'}}],departed:[]};},
};
for(const[name,mutate]of Object.entries(mutations))test('rejects '+name,()=>{const i=structuredClone(input);mutate(i);assert.throws(()=>buildMidnightClergyPost(state,i,'a'.repeat(64),true));});
test('requires separate printed variant confirmation and explicit bishop title',()=>{
  assert.throws(()=>buildMidnightClergyPost(state,input,'a'.repeat(64),false));
  assert.throws(()=>buildMidnightClergyPost({...state,midnightBishopTitle:undefined},input,'a'.repeat(64),true));
});
