import { catalogRequest } from '../collaboration/catalog-client';
import { interfaceLanguage, INTERFACE_LANGUAGE_LOCALES } from '../i18n/interface-language';
export interface PrintConfig {
  revision:number; enabled:boolean; currency:string; taxNote:string; terms:string; notificationEmail?:string; maxPages:number; minQuantity:number; weights:Record<string,number>; stripeReady?:boolean;
  formats:Record<string,{min:number;price:number}[]>; paper:Record<string,number>; cover:Record<string,number>; delivery:Record<string,number>;
  services:{id:string;name:string;price:number;enabled:boolean;perCopy:boolean}[];
}
export interface PrintQuote {currency:string;total:number;format:string;pages:number;taxNote:string;terms:string;pricingRevision:number;lines:{name:string;quantity:number;unit:number;total:number}[]}
export interface PrintOrder {id:string;email:string;owner:string;name:string;quantity:number;paper:string;cover:string;delivery:string;createdAt:string;status:string;payment:string;notification:string;quote:PrintQuote;contact:Record<string,string>;stripeInvoice?:string;history:{at:string;status:string}[]}
export interface PrintSource {calendarId:string;calendarRevision:number;pdfId:string}
export const printRequest = <T>(path:string,method='GET',body?:unknown,admin=false) => catalogRequest<T>(`${admin?'admin/':''}print/${path}`,method,body);
export const printMoney = (amount:number,currency:string) => new Intl.NumberFormat(INTERFACE_LANGUAGE_LOCALES[interfaceLanguage.value],{style:'currency',currency}).format(amount/100);
export const printOption = (key:string) => ({matte:'Матовая',glossy:'Глянцевая',pickup:'Самовывоз',shipping:'Доставка'}[key]??key);
export const printContactLabel = (key:string) => ({name:'Имя',phone:'Телефон',address:'Адрес',company:'Организация',taxId:'Налоговый номер',comment:'Комментарий'}[key]??key);
export const printStatus = (key:string) => ({refunded:'Полный возврат',partially_refunded:'Частичный возврат',requested:'Заявка — ожидает проверки',approved:'Подтверждён — можно оплатить',paid:'Оплачен',production:'В печати',shipped:'Отправлен',completed:'Выполнен',rejected:'Отклонён',unpaid:'Не оплачен',sent:'Отправлено',failed:'Ошибка отправки',pending:'Ожидает отправки'}[key]??key);
