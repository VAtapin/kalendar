import { createApp } from "vue";
import App from "./App.vue";
import PublicSitePage from './components/PublicSitePage.vue';
import "./styles.css";
import { installInterfaceTranslator } from "./i18n/interface-language";

createApp(new URLSearchParams(location.search).has('page') ? PublicSitePage : App).mount("#app");
const appRoot = document.querySelector("#app");
if (appRoot) installInterfaceTranslator(appRoot);
