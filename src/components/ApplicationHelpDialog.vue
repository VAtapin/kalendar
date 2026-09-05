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
  guide: "Помощь",
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
            <li>На стартовой странице нажмите «Создать календарь» и войдите в кабинет. При регистрации подтвердите e-mail по ссылке из письма и установите пароль. Далее входите по e-mail и паролю.</li>
            <li>В меню «Макет» создайте обложку и 12 месяцев либо добавляйте страницы по одной.</li>
            <li>Выберите страницу, затем объект на листе или в панели «Слои».</li>
            <li>Настройте геометрию, оформление и содержимое справа в панели «Свойства».</li>
          </ol>
        </section>
        <section>
          <h3>Рабочее пространство</h3>
          <p><strong>Верхнее меню</strong> — создание, импорт, сохранение, скачивание копии, экспорт, команды макета и помощь. Полоса под ним показывает координаты и размер выбранного объекта.</p>
          <p><strong>Левая панель</strong> — выбор, текст, изображения, фигуры, сетка, рука, масштаб и шаблоны. <strong>Центр</strong> — печатная страница с линейками и направляющими.</p>
          <p><strong>Правая панель</strong> — свойства, библиотека золотых и SVG‑элементов, слои, страницы с превью, монастырские события и предпечатная проверка. Её левую границу можно тянуть мышью.</p>
          <p><strong>Фотографии</strong> в инструментах открывает и скрывает фотопанель; её правую границу можно тянуть мышью. Перенос фото на пустую рамку заполняет её, а на свободное место или другое фото добавляет отдельный объект.</p>
          <p>Delete убирает фото из рамки, оставляя пустую рамку выделенной. Повторное удаление удаляет саму рамку. Отдельная фотография удаляется сразу. Ctrl+Z отменяет удаление.</p>
          <p><strong>Нижняя строка</strong> — результаты проверки, состояние сохранения и подготовки PDF.</p>
        </section>
        <section>
          <h3>Где хранятся календари?</h3>
          <p><strong>Сохранить</strong> сохраняет календарь в личном кабинете на сервере. Изменения также сохраняются автоматически. <strong>Скачать копию…</strong> создаёт файл на компьютере. <strong>Импортировать файл календаря…</strong> после входа добавляет файл в кабинет как отдельный календарь.</p>
          <p>Основная копия хранится на сервере в вашем кабинете вместе с фотографиями. Файл <code>.kalendar</code> — дополнительная копия по желанию. Состояние «Ошибка» означает, что последние изменения ещё не сохранены.</p>
        </section>
        <section>
          <h3>Язык интерфейса</h3>
          <p>Язык интерфейса можно выбрать на стартовой странице или в меню Файл → Настройки программы…. Он меняет меню, кнопки, подсказки и окна, но не язык печатного календаря.</p>
        </section>
        <section>
          <h3>Язык календаря</h3>
          <p>Выберите его в панели «Свойства», когда не выделен объект. Эта настройка меняет названия месяцев и дней недели, церковные праздники, постные обозначения и имена святых в редакторе и PDF. Она сохраняется вместе с календарём.</p>
        </section>
        <section>
          <h3>Страницы и восстановление</h3>
          <p>В панели «Страницы» можно добавить пустую страницу и удалить ненужную. Удаление отменяется через Ctrl+Z. В кабинете доступны предыдущие серверные версии каждого календаря и корзина удалённых календарей.</p>
        </section>
        <section>
          <h3>Календарная сетка</h3>
          <p>Параметры числа, старого стиля, текста событий, знаков типикона и поста задаются независимо. В «Шаблонах календаря» доступны не менее пяти общих макетов сетки: примените один из них к выбранному месяцу или сразу ко всем месяцам, затем измените параметры в «Свойствах». Только подтверждённый владелец мастерской может сохранить изменённую сетку как общий макет для всех пользователей.</p>
        </section>
        <section>
          <h3>Изображения, скругление и маски</h3>
          <p>В режиме «С обрезкой» ползунки «Положение кадра» сдвигают изображение внутри его рамки по горизонтали и вертикали. Кнопка «По центру» возвращает исходное положение.</p>
          <p>Параметр «Скругление» действует на любой объект. Маска принадлежит слою и настраивается во вкладке «Слои»: загрузите чёрно-белое изображение либо примените уже размещённый PNG/SVG‑элемент. Белое показывает слой, чёрное скрывает, серое даёт полупрозрачность. Исходный объект при этом не меняется.</p>
        </section>
        <section>
          <h3>Печать</h3>
          <p>Перед экспортом откройте панель «Проверка», устраните ошибки и проверьте предупреждения. Команда «Экспортировать печатный PDF…» подготовит многостраничный файл с реальными размерами, вылетами и метками реза, после чего покажет кнопку скачивания.</p>
        </section>
      </div>

      <div v-else-if="page === 'shortcuts'" class="application-dialog__content">
        <table class="shortcut-table">
          <tbody>
            <tr><th colspan="2">Файл</th></tr>
            <tr><td>Новый проект</td><td><kbd>Ctrl</kbd> + <kbd>N</kbd></td></tr>
            <tr><td>Открыть проект</td><td><kbd>Ctrl</kbd> + <kbd>O</kbd></td></tr>
            <tr><td>Сохранить</td><td><kbd>Ctrl</kbd> + <kbd>S</kbd></td></tr>
            <tr><td>Скачать копию…</td><td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd></td></tr>
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
        <img class="about-program__mark" src="/brand/logo-symbol-256.webp" alt="" />
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
