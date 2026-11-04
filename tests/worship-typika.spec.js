import{describe,it,expect,vi}from'vitest';
import{TYPIKA_VARIANT,typikaParams,readTypikaSelection,fetchTypikaParts,bindTypikaConfirmation,retainTypikaConfirmation}from'../public/calendar-ui/worship-typika.js';
import{renderWorshipReader}from'../public/calendar-ui/worship-reader.js';
import{create,descendants}from'./fixtures/worship-dom.mjs';
const state={office:'typika',date:'2026-01-01',temple:'transfiguration',sequence:'standalone',textLanguage:'cu',textSize:22,typikaVariant:TYPIKA_VARIANT,typikaNoLiturgy:true};
describe('explicit conditional Typika selection',()=>{
 it('sends the exact typed source choice without local names or inferred date appointment',()=>{
  expect(typikaParams(state)).toEqual({date:state.date,language:'cu',calendarStyle:'julian',temple:state.temple,sourceVariantId:TYPIKA_VARIANT,typikaNoLiturgy:'1'});
 });
 it.each([{typikaNoLiturgy:false},{typikaNoLiturgy:'1'},{typikaVariant:''},{typikaVariant:'unknown'},{temple:'nicholas'},{date:'2026-02-31'}])('rejects incomplete or foreign input %s',extra=>expect(()=>typikaParams({...state,...extra})).toThrow());
 it('does not request source words until both choices are explicit',async()=>{
  const fetcher=vi.fn();expect((await fetchTypikaParts('https://offline.invalid',{...state,typikaNoLiturgy:false},fetcher)).status).toBe('typika-context-required');expect(fetcher).not.toHaveBeenCalled();
 });
 it('round-trips only the explicit boolean wire value',()=>{
  const selected={};readTypikaSelection(new URLSearchParams({typikaVariant:TYPIKA_VARIANT,typikaNoLiturgy:'1'}),selected);expect(selected).toEqual({typikaVariant:TYPIKA_VARIANT,typikaNoLiturgy:true});
  readTypikaSelection(new URLSearchParams({typikaNoLiturgy:'true'}),selected);expect(selected.typikaNoLiturgy).toBe(false);
 });
 it('invalidates confirmation when a date changes outside the reader controls',()=>{
  const selected={...state};bindTypikaConfirmation(selected);retainTypikaConfirmation(selected);expect(selected.typikaNoLiturgy).toBe(true);
  selected.date='2026-06-30';retainTypikaConfirmation(selected);expect(selected.typikaNoLiturgy).toBe(false);
 });
 it('shows existing reader controls and disables printing before confirmation',()=>{
  const reader=renderWorshipReader({state:{...state,typikaNoLiturgy:false},create,formatDate:d=>d,onChange(){},onRetry(){}});reader.render({status:'typika-context-required'});
  const nodes=descendants(reader.page);expect(nodes.find(n=>n.dataset.worshipControl==='typikaVariant')).toBeTruthy();expect(nodes.find(n=>n.dataset.worshipControl==='typikaNoLiturgy').checked).toBe(false);
  expect(nodes.find(n=>n.textContent==='Печать службы').disabled).toBe(true);expect(nodes.find(n=>n.textContent==='Скачать PDF').disabled).toBe(true);reader.dispose();
 });
});
