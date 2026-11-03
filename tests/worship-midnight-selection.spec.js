import{test}from'vitest';import assert from'node:assert/strict';
import{MIDNIGHT_URL_KEYS,readMidnightSelection}from'../public/calendar-ui/worship-midnight-context.js';
test('reads only explicit public selection and retains calendar fasting and Ninth-hour context',()=>{
  const state={profile:'typikon-strict',location:'narthex'};
  readMidnightSelection(new URLSearchParams('midnightProfile=clergy&midnightLocation=cell&midnightBishopTitle=metropolitan&localContext=private&people=private'),state);
  assert.deepEqual(state,{profile:'typikon-strict',location:'narthex',midnightProfile:'clergy',midnightLocation:'cell',midnightBishopTitle:'metropolitan'});
  assert.equal(MIDNIGHT_URL_KEYS.length,3);assert.ok(!MIDNIGHT_URL_KEYS.includes('localContext'));
});
test('unknown and missing values reset to the documented public defaults',()=>{
  const state={midnightProfile:'clergy'};readMidnightSelection(new URLSearchParams('midnightProfile=unknown&midnightLocation=narthex'),state);
  assert.deepEqual(state,{midnightProfile:'reader',midnightLocation:'church',midnightBishopTitle:'bishop'});
});
