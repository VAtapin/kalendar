<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";

export type HelpDialogPage = "guide" | "shortcuts" | "about";

const props = defineProps<{
  page: HelpDialogPage;
}>();

const emit = defineEmits<{
  close: [];
}>();

const dialog = ref<HTMLElement>();
const title = computed(() => ({
  guide: "Справка по работе",
  shortcuts: "Горячие клавиши",
  about: "О программе",
})[props.page]);

onMounted(async () => {
  await nextTick();
  dialog.value?.focus();
});
</script>

<template>
  <div class="application-dialog-backdrop" @click.self="emit('close')">
    <section
      ref="dialog"
      class="application-dialog"
      :class="{ 'application-dialog--about': page === 'about' }"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
      @keydown.esc.stop="emit('close')"
    >
      <header class="application-dialog__header">
        <div>
          <span class="application-dialog__eyebrow">Календарная мастерская</span>
          <h2>{{ title }}</h2>
        </div>
        <button type="button" class="application-dialog__close" aria-label="Закрыть" @click="emit('close')">×</button>
      </header>

      <div v-if="page === 'guide'" class="application-dialog__content help-guide">
        <section>
          <h3>Начало работы</h3>
          <ol>
            <li>В меню «Макет» создайте обложку и 12 месяцев либо добавляйте страницы по одной.</li>
            <li>Выберите страницу, затем объект на листе или в панели «Слои».</li>
            <li>Настройте геометрию, оформление и содержимое справа в панели «Свойства».</li>
          </ol>
        </section>
        <section>
          <h3>Сохранение проекта</h3>
          <p><strong>Сохранить</strong> впервые предложит выбрать файл, а затем обновляет тот же файл. <strong>Сохранить как…</strong> создаёт новый файл проекта. Это прямое сохранение поддерживается в Chrome и Edge; в браузерах без доступа к файловой системе редактор создаёт новую загрузку.</p>
          <p>Автовосстановление и резервные точки хранятся локально в браузере и не заменяют файл <code>.kalendar</code>.</p>
        </section>
        <section>
          <h3>Календарная сетка</h3>
          <p>Параметры числа, старого стиля, текста событий, знаков типикона и поста задаются независимо. Кнопка «Шаблоны календаря» в левой панели открывает заготовки проекта и сетки; готовую сетку можно применить ко всем месяцам.</p>
        </section>
        <section>
          <h3>Печать</h3>
          <p>Перед экспортом откройте панель «Проверка», устраните ошибки и проверьте предупреждения. Команда «Экспортировать печатный PDF…» формирует многостраничный файл с реальными размерами, вылетами и метками реза.</p>
        </section>
      </div>

      <div v-else-if="page === 'shortcuts'" class="application-dialog__content">
        <table class="shortcut-table">
          <tbody>
            <tr><th colspan="2">Файл</th></tr>
            <tr><td>Новый проект</td><td><kbd>Ctrl</kbd> + <kbd>N</kbd></td></tr>
            <tr><td>Открыть проект</td><td><kbd>Ctrl</kbd> + <kbd>O</kbd></td></tr>
            <tr><td>Сохранить</td><td><kbd>Ctrl</kbd> + <kbd>S</kbd></td></tr>
            <tr><td>Сохранить как…</td><td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd></td></tr>
            <tr><td>Экспортировать PDF</td><td><kbd>Ctrl</kbd> + <kbd>E</kbd></td></tr>
            <tr><th colspan="2">Редактирование</th></tr>
            <tr><td>Отменить / повторить</td><td><kbd>Ctrl</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd></td></tr>
            <tr><td>Дублировать объект</td><td><kbd>Ctrl</kbd> + <kbd>D</kbd></td></tr>
            <tr><td>Удалить выбранное</td><td><kbd>Delete</kbd> или <kbd>Backspace</kbd></td></tr>
            <tr><td>Переместить объект на 1 мм</td><td><kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd></td></tr>
            <tr><td>Переместить объект на 10 мм</td><td><kbd>Shift</kbd> + стрелка</td></tr>
            <tr><th colspan="2">Инструменты и вид</th></tr>
            <tr><td>Выделение / текст / изображение</td><td><kbd>V</kbd> / <kbd>T</kbd> / <kbd>F</kbd></td></tr>
            <tr><td>Прямоугольник / эллипс / линия</td><td><kbd>M</kbd> / <kbd>L</kbd> / <kbd>\</kbd></td></tr>
            <tr><td>Рука / масштаб</td><td><kbd>H</kbd> / <kbd>Z</kbd></td></tr>
            <tr><td>Увеличить / уменьшить масштаб</td><td><kbd>+</kbd> / <kbd>−</kbd></td></tr>
            <tr><td>Страница целиком</td><td><kbd>Ctrl</kbd> + <kbd>0</kbd></td></tr>
            <tr><td>Скрыть или показать панели</td><td><kbd>Tab</kbd></td></tr>
          </tbody>
        </table>
        <p class="application-dialog__note">Однобуквенные команды не срабатывают во время ввода текста или значений в полях.</p>
      </div>

      <div v-else class="application-dialog__content about-program">
        <div class="about-program__mark" aria-hidden="true">КМ</div>
        <div>
          <h3>Календарная мастерская</h3>
          <p class="about-program__version">Версия 0.1.0</p>
        </div>
        <p>Издательский инструмент для подготовки православных печатных календарей.</p>
        <section>
          <h3>Проект монастыря</h3>
          <p>Свято‑Георгиевский мужской монастырь Берлинской епархии в Гётчендорфе.</p>
          <a href="https://georg-kloster.ru/" target="_blank" rel="noreferrer">georg-kloster.ru</a>
        </section>
        <section>
          <h3>Разработка</h3>
          <p><a href="https://atapin.de/" target="_blank" rel="noreferrer">ATAPIN.DE</a></p>
          <p><a href="tel:+491713517274">+49 171 351 72 74</a></p>
          <p><a href="mailto:atapin@gmail.com">atapin@gmail.com</a></p>
        </section>
      </div>

      <footer class="application-dialog__footer">
        <button type="button" class="primary-action" @click="emit('close')">Закрыть</button>
      </footer>
    </section>
  </div>
</template>
