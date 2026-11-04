import{describe,it,expect}from'vitest';
import{requestedOfficeMode,officeModeIdentity}from'../public/calendar-ui/worship-office-mode.js';
const state={office:'liturgy',rite:'john-chrysostom',date:'2026-12-14',temple:'nicholas',sequence:'default',textLanguage:'cu'};
describe('typed office preparation mode',()=>{
 it('uses documented auto omission and separates request identities',()=>{
  expect(requestedOfficeMode(state)).toBe('auto');
  expect(officeModeIdentity(state)).toBe(officeModeIdentity({...state,officeMode:'auto'}));
  expect(officeModeIdentity(state)).not.toBe(officeModeIdentity({...state,officeMode:'alleluia'}));
  expect(officeModeIdentity(state)).not.toBe(officeModeIdentity({...state,temple:'dormition'}));
 });
 it.each([null,'unknown','',false])('rejects invalid explicit values %s',officeMode=>expect(()=>requestedOfficeMode({...state,officeMode})).toThrow());
 it.each([{rite:'basil'},{office:'vespers'},{textLanguage:'ru'},{sequence:'vigil'},{date:'2026-02-31'},{temple:'unknown'}])('rejects foreign contexts %s',extra=>expect(()=>requestedOfficeMode({...state,officeMode:'alleluia',...extra})).toThrow());
});
