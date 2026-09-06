import { createApp } from "vue";
import BrowserApp from './BrowserApp.vue';
import "./styles.css";
import { installInterfaceTranslator } from "./i18n/interface-language";
import { completeDomainSession } from './domain-session';

void completeDomainSession().then(redirecting=>{
  if(redirecting)return;
  createApp(BrowserApp).mount("#app");
  const appRoot = document.querySelector("#app");
  if (appRoot) installInterfaceTranslator(appRoot);
}).catch(()=>{
  const root=document.querySelector('#app');
  if(root){root.textContent='Не удалось перенести вход / Anmeldung konnte nicht übertragen werden. ';const link=document.createElement('a');link.href='/account';link.textContent='Войти / Anmelden';root.append(link);}
});
