import { createApp } from "vue";
import BrowserApp from './BrowserApp.vue';
import "./styles.css";
import { installInterfaceTranslator } from "./i18n/interface-language";

createApp(BrowserApp).mount("#app");
const appRoot = document.querySelector("#app");
if (appRoot) installInterfaceTranslator(appRoot);
