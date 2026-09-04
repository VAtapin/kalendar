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
        <p>Создайте обложку и страницы на каждый месяц, добавьте праздники, посты, фотографии и оформление — и получите готовый PDF для печати.</p>
        <div class="welcome-hero__actions">
          <button type="button" class="welcome-primary" data-testid="welcome-create" @click="emit('create')">Создать календарь</button>
          <button v-if="currentProjectName" type="button" @click="emit('continue')">Продолжить последний</button>
          <button type="button" @click="emit('open')">Открыть календарь…</button>
        </div>
      </div>
      <img class="welcome-hero__art" src="/brand/share-card.png" alt="Календарная мастерская Свято-Георгиевского монастыря" />
    </section>

    <section class="welcome-features" aria-label="Возможности">
      <article><strong>Точный календарь</strong><span>Даты, праздники, посты и монастырские события.</span></article>
      <article><strong>Свободная вёрстка</strong><span>Страницы, слои, фотографии, текст и золотой декор.</span></article>
      <article><strong>Совместная работа</strong><span>Передайте ссылку другому человеку, чтобы вместе подготовить календарь.</span></article>
      <article><strong>Готово к печати</strong><span>Скачайте готовый PDF и передайте его в типографию.</span></article>
    </section>

    <section class="welcome-projects">
      <div class="welcome-section-title">
        <div><h2>Мои календари</h2></div>
        <button type="button" @click="emit('help')">Помощь</button>
      </div>
      <div class="welcome-projects__grid">
        <button v-if="currentProjectName" type="button" @click="emit('continue')">
          <strong>{{ currentProjectName }}</strong><span>Последняя работа · сохранена на этом компьютере</span>
        </button>
        <button v-for="item in sharedProjects" :key="item.id" type="button" @click="emit('openShared', item.id)">
          <strong>{{ item.name }}</strong><span>Совместная версия · доступна по ссылке</span>
        </button>
        <button type="button" @click="emit('open')">
          <strong>Открыть календарь с компьютера</strong><span>Выберите ранее сохранённый файл календаря</span>
        </button>
      </div>
    </section>

    <footer class="welcome-page__footer">
      <span>Проект Свято‑Георгиевского мужского монастыря</span>
      <button type="button" @click="emit('help')">Помощь</button>
      <a href="https://atapin.de/" target="_blank" rel="noreferrer">Разработка ATAPIN.DE</a>
    </footer>
  </main>
</template>
