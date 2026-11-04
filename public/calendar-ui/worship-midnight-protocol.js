// Exact source-review transition; ordinary historical receipts remain supported.
import {partsHash} from './worship-hash.js';
export const MIDNIGHT_PROTOCOLS={
  ab431b34ecfd2028f516bab274bb99d91b86b05d89682f9ca330632a1007563f:'d0fc075a512cb8b7881d4d64fde43545ab25190164ca8564eca20e810adb4e51',
  '22a74e0040f0bf1f2cc9e3449b656e8254eb19bd6a7fc6666b6b9df05966bb09':'fc2d3e13d3cd29f9d9fc80b613e321fc5d66d30a20975760397c738c22035e6a',
};
export const HOLY_SPIRIT_RULES='22a74e0040f0bf1f2cc9e3449b656e8254eb19bd6a7fc6666b6b9df05966bb09';
export const HOLY_SPIRIT_CLASS='holy-spirit-monday-standalone-no-vigil';
export const HOLY_SPIRIT_READER_VERSION='22962a531b08fba1efba589350a65466628350e8a71b6978d792bb7cd0c9d2e3';
export const HOLY_SPIRIT_READER_BODY='b8daa78e8933ee4ac3219e71c08610791b38405e9694a3bc3b09c8012604696b';
export function midnightSourceClass(variant,rules){
  return variant==='holy-spirit-monday'&&rules===HOLY_SPIRIT_RULES?HOLY_SPIRIT_CLASS:'ordinary-standalone-no-vigil';
}
export async function validateHolySpiritNative(blocks){
  const selected=blocks.filter(b=>b.provenance?.parentSlot==='holy-spirit-kontakion');
  if(selected.length!==1)throw Error('Missing or duplicate native Holy Spirit kontakion');
  const b=selected[0];
  if(await partsHash({kind:b.kind,segments:b.segments,provenance:b.provenance})!=='ccf1c9eaabd16d033b92dce4d6c73a365b8bff585c97f2747ee88eae209c563a')throw Error('Changed native Holy Spirit source block/range');
}
