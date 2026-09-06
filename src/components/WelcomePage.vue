<script setup lang="ts">
import { nextTick, ref } from "vue";
import LegalLinks from './LegalLinks.vue';
import {localizedPath} from '../navigation';
import type { InterfaceLanguage } from "../document/types";
import {
  INTERFACE_LANGUAGE_OPTIONS,
  interfaceLanguage,
} from "../i18n/interface-language";

const props = defineProps<{
  currentProjectName?: string;
  recentProjectNames: string[];
  sharedProjects: Array<{ id: string; name: string }>;
  compactMode?: boolean;
}>();

const emit = defineEmits<{
  create: [];
  continue: [];
  open: [];
  openShared: [id: string];
  help: [];
  admin: [];
  account: [];
  languageChange: [language: InterfaceLanguage];
}>();

const desktopRequiredOpen = ref(false);
const desktopRequiredDialog = ref<HTMLElement>();

async function requireDesktop(): Promise<boolean> {
  if (!props.compactMode) return false;
  desktopRequiredOpen.value = true;
  await nextTick();
  desktopRequiredDialog.value?.focus();
  return true;
}

async function requestCreate(): Promise<void> {
  if (!(await requireDesktop())) emit("create");
}

async function requestContinue(): Promise<void> {
  if (!(await requireDesktop())) emit("continue");
}

async function requestOpen(): Promise<void> {
  if (!(await requireDesktop())) emit("open");
}

async function requestOpenShared(id: string): Promise<void> {
  if (!(await requireDesktop())) emit("openShared", id);
}

function changeInterfaceLanguage(event: Event): void {
  emit("languageChange", (event.target as HTMLSelectElement).value as InterfaceLanguage);
}
</script>

<template>
  <main class="welcome-page">
    <header class="welcome-page__header">
      <img src="/brand/logo-kalendar-preview.webp" alt="Календарная мастерская при Свято-Георгиевском монастыре" />
      <div class="welcome-page__header-actions">
        <label>
          <span class="visually-hidden">Язык интерфейса</span>
          <select :value="interfaceLanguage" aria-label="Язык интерфейса" @change="changeInterfaceLanguage">
            <option v-for="option in INTERFACE_LANGUAGE_OPTIONS" :key="option.id" :value="option.id" :lang="option.id">
              {{ option.nativeLabel }}
            </option>
          </select>
        </label>
        <a href="https://georg-kloster.ru/" target="_blank" rel="noreferrer">georg-kloster.ru</a>
        <button type="button" @click="emit('account')">Личный кабинет</button>
      </div>
    </header>

    <section class="welcome-hero">
      <div>
        <span class="welcome-hero__eyebrow">Издательский онлайн‑инструмент монастыря</span>
        <h1>Создайте православный календарь, готовый к печати</h1>
        <p>Создайте обложку и страницы на каждый месяц, добавьте праздники, посты, фотографии и оформление — и получите готовый PDF для печати.</p>
        <div class="welcome-hero__actions">
          <button type="button" class="welcome-primary" data-testid="welcome-create" @click="requestCreate">Создать календарь</button>
          <button v-if="currentProjectName" type="button" @click="requestContinue">Продолжить последний</button>
          <button type="button" @click="requestOpen">Импортировать календарь…</button>
        </div>
        <p><a :href="localizedPath('/videos')">Как пользоваться? Видеоуроки</a></p>
      </div>
      <img class="welcome-hero__art" src="/brand/share-card-preview.webp" alt="Календарная мастерская Свято-Георгиевского монастыря" />
    </section>

    <section class="welcome-features" aria-label="Возможности">
      <article><strong>Точный календарь</strong><span>Даты, праздники, посты и монастырские события.</span></article>
      <article><strong>Свободная вёрстка</strong><span>Страницы, слои, фотографии, текст и золотой декор.</span></article>
      <article><strong>Личный кабинет</strong><span>Календари и фотографии сохраняются на сервере и доступны после входа.</span></article>
      <article><strong>Готово к печати</strong><span>Скачайте готовый PDF и передайте его в типографию.</span></article>
    </section>

    <section class="welcome-mobile-about" aria-label="О проекте">
      <div>
        <span class="welcome-hero__eyebrow">О проекте</span>
        <h2>Календарная мастерская</h2>
        <p>Онлайн‑инструмент для подготовки православных календарей: от церковных дат и постов до собственной вёрстки и печатного PDF.</p>
      </div>
      <article>
        <h3>Свято‑Георгиевский мужской монастырь</h3>
        <p>Проект монастыря Берлинской епархии в Гётчендорфе.</p>
        <a href="https://georg-kloster.ru/" target="_blank" rel="noreferrer">georg-kloster.ru</a>
      </article>
      <article>
        <h3>Разработка и связь</h3>
        <a href="https://atapin.de/" target="_blank" rel="noreferrer">ATAPIN.DE</a>
        <a href="tel:+491713517274">+49 171 351 72 74</a>
        <a href="mailto:atapin@gmail.com">atapin@gmail.com</a>
      </article>
    </section>

    <section class="welcome-projects">
      <div class="welcome-section-title">
        <div><h2>Мои календари</h2></div>
        <button type="button" @click="emit('help')">Помощь</button>
      </div>
      <div class="welcome-projects__grid">
        <button type="button" @click="emit('account')"><strong>Личный кабинет</strong><span>Все мои календари, фотографии и серверные версии</span></button>
        <button v-if="currentProjectName" type="button" @click="requestContinue">
          <strong>{{ currentProjectName }}</strong><span>Продолжить открытую работу</span>
        </button>
        <button v-for="item in sharedProjects" :key="item.id" type="button" @click="requestOpenShared(item.id)">
          <strong>{{ item.name }}</strong><span>Совместная версия · доступна по ссылке</span>
        </button>
        <button type="button" @click="requestOpen">
          <strong>Импортировать календарь с компьютера</strong><span>Добавьте файл календаря в свой личный кабинет</span>
        </button>
      </div>
    </section>

    <footer class="welcome-page__footer">
      <div class="welcome-page__footer-tools">
        <button type="button" @click="emit('help')">Помощь</button>
        <a href="https://atapin.de/" target="_blank" rel="noreferrer">Разработка ATAPIN.DE</a>
      </div>
      <LegalLinks />
    </footer>

    <div v-if="desktopRequiredOpen" class="application-dialog-backdrop" @click.self="desktopRequiredOpen = false">
      <section
        ref="desktopRequiredDialog"
        class="application-dialog welcome-device-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Для работы нужен большой экран"
        tabindex="-1"
        @keydown.esc.stop="desktopRequiredOpen = false"
      >
        <header class="application-dialog__header">
          <div>
            <span class="application-dialog__eyebrow">Календарная мастерская</span>
            <h2>Для работы нужен большой экран</h2>
          </div>
          <button type="button" class="application-dialog__close" aria-label="Закрыть" @click="desktopRequiredOpen = false">×</button>
        </header>
        <div class="application-dialog__content welcome-device-dialog__content">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <rect x="7" y="10" width="50" height="34" rx="3" />
            <path d="M25 54h14M32 44v10" />
          </svg>
          <p>Создание и редактирование календаря рассчитано на компьютер или устройство с большим экраном.</p>
          <p>Откройте, пожалуйста, эту же страницу или полученную ссылку на компьютере.</p>
        </div>
        <footer class="application-dialog__footer">
          <button type="button" class="primary-action" @click="desktopRequiredOpen = false">Понятно</button>
        </footer>
      </section>
    </div>
  </main>
</template>
