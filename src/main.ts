import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";
import { installInterfaceTranslator } from "./i18n/interface-language";

createApp(App).mount("#app");
const appRoot = document.querySelector("#app");
if (appRoot) installInterfaceTranslator(appRoot);
