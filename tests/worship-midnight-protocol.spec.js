import{describe,it,expect}from'vitest';
import{MIDNIGHT_PROTOCOLS,HOLY_SPIRIT_RULES,HOLY_SPIRIT_CLASS,midnightSourceClass,validateHolySpiritNative}from'../public/calendar-ui/worship-midnight-protocol.js';
describe('bounded Holy Spirit Midnight protocol',()=>{
 it('supports exactly two source review generations',()=>expect(Object.keys(MIDNIGHT_PROTOCOLS)).toHaveLength(2));
 it('binds the new variant only to its own source generation',()=>{
  expect(midnightSourceClass('holy-spirit-monday',HOLY_SPIRIT_RULES)).toBe(HOLY_SPIRIT_CLASS);
  expect(midnightSourceClass('holy-spirit-monday','unknown')).not.toBe(HOLY_SPIRIT_CLASS);
  expect(midnightSourceClass('weekday-ordinary-summer',HOLY_SPIRIT_RULES)).toBe('ordinary-standalone-no-vigil');
 });
 it('refuses absent and fabricated native K bindings',async()=>{
  await expect(validateHolySpiritNative([])).rejects.toThrow();
  await expect(validateHolySpiritNative([{kind:'text',segments:[],provenance:{parentSlot:'holy-spirit-kontakion'}}])).rejects.toThrow();
 });
});
