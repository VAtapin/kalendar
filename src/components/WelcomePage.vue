<script setup lang="ts">
defineProps<{
  currentProjectName?: string;
  recentProjectNames: string[];
  sharedProjects: Array<{ id: string; name: string }>;
}>();

const emit = defineEmits<{
  create: [];
  continue: [];
  open: [];
  openShared: [id: string];
  help: [];
}>();
</script>

<template>
  <main class="welcome-page">
    <header class="welcome-page__header">
      <img src="/brand/logo-kalendar.png" alt="Календарная мастерская при Свято-Георгиевском монастыре" />
      <a href="https://georg-kloster.ru/" target="_blank" rel="noreferrer">georg-kloster.ru</a>
    </header>

    <section class="welcome-hero">
      <div>
        <span class="welcome-hero__eyebrow">Издательский онлайн‑инструмент монастыря</span>
        <h1>Создайте православный календарь, готовый к печати</h1>
        <p>Обложка, двенадцать месяцев, церковный календарь, посты, собственные фотографии и профессиональный PDF — в одном редакторе.</p>
        <div class="welcome-hero__actions">
          <button type="button" class="welcome-primary" data-testid="welcome-create" @click="emit('create')">Создать календарь</button>
          <button v-if="currentProjectName" type="button" @click="emit('continue')">Продолжить работу</button>
          <button type="button" @click="emit('open')">Открыть файл…</button>
        </div>
      </div>
      <img class="welcome-hero__art" src="/brand/share-card.png" alt="Календарная мастерская Свято-Георгиевского монастыря" />
    </section>

    <section class="welcome-features" aria-label="Возможности">
      <article><strong>Точный календарь</strong><span>Даты, праздники, посты и монастырские события.</span></article>
      <article><strong>Свободная вёрстка</strong><span>Страницы, слои, фотографии, текст и золотой декор.</span></article>
      <article><strong>Совместная работа</strong><span>Отправьте ссылку: один редактирует, остальные ждут или делают копию.</span></article>
      <article><strong>Печатный PDF</strong><span>Файл сохраняется на сервере и скачивается по устойчивой ссылке.</span></article>
    </section>

    <section v-if="currentProjectName || recentProjectNames.length || sharedProjects.length" class="welcome-projects">
      <div class="welcome-section-title">
        <div><span>Ваше рабочее место</span><h2>Мои календари</h2></div>
        <button type="button" @click="emit('help')">Где что находится?</button>
      </div>
      <div class="welcome-projects__grid">
        <button v-if="currentProjectName" type="button" @click="emit('continue')">
          <strong>{{ currentProjectName }}</strong><span>Последнее локальное автосохранение</span>
        </button>
        <button v-for="item in sharedProjects" :key="item.id" type="button" @click="emit('openShared', item.id)">
          <strong>{{ item.name }}</strong><span>Общий календарь на сервере</span>
        </button>
        <button v-for="name in recentProjectNames" :key="name" type="button" @click="emit('open')">
          <strong>{{ name }}</strong><span>Недавний локальный файл — выбрать на компьютере</span>
        </button>
      </div>
    </section>

    <footer class="welcome-page__footer">
      <span>Проект Свято‑Георгиевского мужского монастыря</span>
      <button type="button" @click="emit('help')">Справка</button>
      <a href="https://atapin.de/" target="_blank" rel="noreferrer">Разработка ATAPIN.DE</a>
    </footer>
  </main>
</template>
