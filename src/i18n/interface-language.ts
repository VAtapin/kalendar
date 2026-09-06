import { ref, watch } from "vue";
import type { InterfaceLanguage } from "../document/types";

export type { InterfaceLanguage } from "../document/types";

export const INTERFACE_LANGUAGE_STORAGE_KEY = "orthodox-calendar-layout:interface-language";

export const INTERFACE_LANGUAGE_OPTIONS: ReadonlyArray<{
  id: InterfaceLanguage;
  nativeLabel: string;
}> = [
  { id: "ru", nativeLabel: "Русский" },
  { id: "de", nativeLabel: "Deutsch" },
  { id: "en", nativeLabel: "English" },
  { id: "uk", nativeLabel: "Українська" },
];

export const INTERFACE_LANGUAGE_LOCALES: Record<InterfaceLanguage, string> = {
  ru: "ru-RU",
  de: "de-DE",
  en: "en-GB",
  uk: "uk-UA",
};

type Translation = Record<Exclude<InterfaceLanguage, "ru">, string>;

/**
 * Interface copy uses the established Russian wording as its stable source key.
 * Calendar content, project names and user-entered text are deliberately absent.
 */
const TRANSLATIONS: Record<string, Translation> = {
  "Личный кабинет": {de:"Mein Konto",en:"My account",uk:"Особистий кабінет"},
  "КАЛЕНДАРНАЯ МАСТЕРСКАЯ": {de:"KALENDERWERKSTATT",en:"CALENDAR WORKSHOP",uk:"КАЛЕНДАРНА МАЙСТЕРНЯ"},
  "Вход": {de:"Anmeldung",en:"Sign in",uk:"Вхід"},
  "Пароль": {de:"Passwort",en:"Password",uk:"Пароль"},
  "Войти": {de:"Anmelden",en:"Sign in",uk:"Увійти"},
  "Выйти": {de:"Abmelden",en:"Sign out",uk:"Вийти"},
  "+ Новый календарь": {de:"+ Neuer Kalender",en:"+ New calendar",uk:"+ Новий календар"},
  "Импортировать календарь": {de:"Kalender importieren",en:"Import calendar",uk:"Імпортувати календар"},
  "Настройки аккаунта": {de:"Kontoeinstellungen",en:"Account settings",uk:"Налаштування облікового запису"},
  "Поиск календаря": {de:"Kalender suchen",en:"Find a calendar",uk:"Пошук календаря"},
  "Название или год": {de:"Name oder Jahr",en:"Name or year",uk:"Назва або рік"},
  "Корзина": {de:"Papierkorb",en:"Trash",uk:"Кошик"},
  "Календарей пока нет. Создайте первый.": {de:"Noch keine Kalender. Erstellen Sie Ihren ersten Kalender.",en:"No calendars yet. Create your first one.",uk:"Календарів поки немає. Створіть перший."},
  "Календари и фотографии сохраняются на сервере. Скачать копию на компьютер можно из меню «Файл» в редакторе.": {de:"Kalender und Fotos werden auf dem Server gespeichert. Eine Kopie können Sie im Editor über das Menü „Datei“ herunterladen.",en:"Calendars and photos are saved on the server. Download a copy from the editor’s File menu.",uk:"Календарі та фотографії зберігаються на сервері. Завантажити копію можна через меню «Файл» у редакторі."},
  "Создать аккаунт / забыли пароль?": {de:"Konto erstellen / Passwort vergessen?",en:"Create account / forgot password?",uk:"Створити обліковий запис / забули пароль?"},
  "Уже есть пароль — войти": {de:"Passwort vorhanden — anmelden",en:"Already have a password — sign in",uk:"Вже є пароль — увійти"},
  "Подождите…": {de:"Bitte warten…",en:"Please wait…",uk:"Зачекайте…"},
  "Страницы сайта": {de:"Website-Seiten",en:"Website pages",uk:"Сторінки сайту"},
  "ИИ-помощник": {de:"KI-Assistent",en:"AI assistant",uk:"ШІ-помічник"},
  "+ Добавить страницу": {de:"+ Seite hinzufügen",en:"+ Add page",uk:"+ Додати сторінку"},
  "Опубликовать": {de:"Veröffentlichen",en:"Publish",uk:"Опублікувати"},
  "Снять с публикации": {de:"Veröffentlichung aufheben",en:"Unpublish",uk:"Зняти з публікації"},
  "Адрес страницы": {de:"Seitenadresse",en:"Page address",uk:"Адреса сторінки"},
  "Порядок в футере": {de:"Reihenfolge in der Fußzeile",en:"Footer order",uk:"Порядок у футері"},
  "Редактировать визуально": {de:"Visuell bearbeiten",en:"Edit visually",uk:"Редагувати візуально"},
  "Создать копию": {de:"Kopie erstellen",en:"Create copy",uk:"Створити копію"},
  "ИИ: написать / улучшить / перевести": {de:"KI: schreiben / verbessern / übersetzen",en:"AI: write / improve / translate",uk:"ШІ: написати / покращити / перекласти"},
  "Применить в редакторе": {de:"Im Editor übernehmen",en:"Apply in editor",uk:"Застосувати в редакторі"},
  "Получить черновик": {de:"Entwurf erstellen",en:"Generate draft",uk:"Отримати чернетку"},
  "Месяц — печатный вид": {de:"Monat — Druckansicht",en:"Month — print preview",uk:"Місяць — друкований вигляд"},
  "Ячейка — перемещение и размер мышью": {de:"Tageszelle — mit der Maus verschieben und skalieren",en:"Day cell — drag and resize",uk:"Комірка — переміщення та розмір мишею"},
  "Правовая информация": { de: "Rechtliche Informationen", en: "Legal information", uk: "Правова інформація" },
  "Оператор и разработчик": { de: "Betreiber und Entwickler", en: "Operator and developer", uk: "Оператор і розробник" },
  "Для заказа печати свяжитесь с нами по следующим контактным данным:": { de: "Für eine Druckbestellung kontaktieren Sie uns bitte:", en: "To order printing, please contact us:", uk: "Для замовлення друку зв’яжіться з нами за такими контактними даними:" },
  "Тираж, стоимость и детали печати обсудим лично.": { de: "Auflage, Preis und Druckdetails besprechen wir persönlich.", en: "We will discuss the quantity, price and printing details personally.", uk: "Тираж, вартість і деталі друку обговоримо особисто." },
  "Заказать печать календаря": { de:"Kalenderdruck bestellen", en:"Order calendar printing", uk:"Замовити друк календаря" },
  "Заказать печать календаря…": { de:"Kalenderdruck bestellen…", en:"Order calendar printing…", uk:"Замовити друк календаря…" },
  "Заказы печати": { de:"Druckaufträge", en:"Print orders", uk:"Замовлення друку" },
  "Мои заказы": { de:"Meine Bestellungen", en:"My orders", uk:"Мої замовлення" },
  "Скрыть заказы": { de:"Bestellungen ausblenden", en:"Hide orders", uk:"Приховати замовлення" },
  "Заказы": { de:"Bestellungen", en:"Orders", uk:"Замовлення" },
  "Клиенты": { de:"Kunden", en:"Customers", uk:"Клієнти" },
  "Счета": { de:"Rechnungen", en:"Invoices", uk:"Рахунки" },
  "Цены и Stripe": { de:"Preise und Stripe", en:"Pricing and Stripe", uk:"Ціни та Stripe" },
  "Тираж, шт.": { de:"Auflage, Stück", en:"Quantity, copies", uk:"Тираж, шт." },
  "Плотность бумаги": { de:"Papiergewicht", en:"Paper weight", uk:"Щільність паперу" },
  "Матовая": { de:"Matt", en:"Matte", uk:"Матова" },
  "Глянцевая": { de:"Glänzend", en:"Glossy", uk:"Глянцева" },
  "Получение": { de:"Abholung / Versand", en:"Collection / delivery", uk:"Отримання" },
  "Самовывоз": { de:"Selbstabholung", en:"Collection", uk:"Самовивіз" },
  "Доставка": { de:"Versand", en:"Delivery", uk:"Доставка" },
  "Дополнительные услуги": { de:"Zusatzleistungen", en:"Additional services", uk:"Додаткові послуги" },
  "Проверка перед печатью": { de:"Druckdatenprüfung", en:"Prepress check", uk:"Перевірка перед друком" },
  "Фолирование первой страницы": { de:"Folierung der ersten Seite", en:"First-page foiling", uk:"Фольгування першої сторінки" },
  "Рассчитать стоимость": { de:"Preis berechnen", en:"Calculate price", uk:"Розрахувати вартість" },
  "Контактные данные": { de:"Kontaktdaten", en:"Contact details", uk:"Контактні дані" },
  "Телефон": { de:"Telefon", en:"Phone", uk:"Телефон" },
  "Организация": { de:"Organisation", en:"Organization", uk:"Організація" },
  "Адрес доставки": { de:"Lieferadresse", en:"Delivery address", uk:"Адреса доставки" },
  "Налоговый номер (если нужен)": { de:"Steuernummer (falls erforderlich)", en:"Tax ID (if needed)", uk:"Податковий номер (за потреби)" },
  "Отправить заявку в типографию": { de:"Anfrage an die Druckerei senden", en:"Send request to printer", uk:"Надіслати заявку до друкарні" },
  "Заявка принята": { de:"Anfrage eingegangen", en:"Request received", uk:"Заявку прийнято" },
  "Оплатить через Stripe": { de:"Mit Stripe bezahlen", en:"Pay with Stripe", uk:"Сплатити через Stripe" },
  "Открыть счёт Stripe": { de:"Stripe-Rechnung öffnen", en:"Open Stripe invoice", uk:"Відкрити рахунок Stripe" },
  "Скачать заказанный PDF": { de:"Bestellte PDF herunterladen", en:"Download ordered PDF", uk:"Завантажити замовлений PDF" },
  "За экземпляр": { de:"Pro Exemplar", en:"Per copy", uk:"За примірник" },
  "Сохранить прайс": { de:"Preisliste speichern", en:"Save pricing", uk:"Зберегти прайс" },
  "Я проверил PDF, состав заказа, стоимость и принимаю условия печати.": { de:"Ich habe die PDF, den Bestellumfang und den Preis geprüft und akzeptiere die Druckbedingungen.", en:"I checked the PDF, order details and price, and accept the printing terms.", uk:"Я перевірив PDF, склад замовлення, вартість і приймаю умови друку." },
  "Сейчас деньги не списываются. После проверки заказа оплатить его можно через Stripe.": { de:"Jetzt wird nichts abgebucht. Nach Prüfung der Bestellung können Sie mit Stripe bezahlen.", en:"No payment is taken now. After review, you can pay via Stripe.", uk:"Зараз кошти не списуються. Після перевірки замовлення можна сплатити через Stripe." },
  "Пост цветом": { de: "Fastenfarben", en: "Fasting colors", uk: "Піст кольором" },
  "Светлые цветные ячейки вместо картинок: категории поста с цветной легендой.": { de: "Helle Farbfelder statt Bilder: Fastenkategorien mit Farblegende.", en: "Light colored cells instead of pictures: fasting categories with a color legend.", uk: "Світлі кольорові клітинки замість зображень: категорії посту з кольоровою легендою." },
  "Файл": { de: "Datei", en: "File", uk: "Файл" },
  "Правка": { de: "Bearbeiten", en: "Edit", uk: "Редагування" },
  "Макет": { de: "Layout", en: "Layout", uk: "Макет" },
  "Объект": { de: "Objekt", en: "Object", uk: "Об’єкт" },
  "Текст": { de: "Text", en: "Text", uk: "Текст" },
  "Вид": { de: "Ansicht", en: "View", uk: "Вигляд" },
  "Окно": { de: "Fenster", en: "Window", uk: "Вікно" },
  "Помощь": { de: "Hilfe", en: "Help", uk: "Допомога" },
  "Главное меню": { de: "Hauptmenü", en: "Main menu", uk: "Головне меню" },
  "Рабочая среда: Издательская": { de: "Arbeitsbereich: Publikation", en: "Workspace: Publishing", uk: "Робоче середовище: Видавниче" },

  "Новый проект": { de: "Neues Projekt", en: "New project", uk: "Новий проєкт" },
  "Открыть проект…": { de: "Projekt öffnen…", en: "Open project…", uk: "Відкрити проєкт…" },
  "Сохранить": { de: "Speichern", en: "Save", uk: "Зберегти" },
  "Сохранить как…": { de: "Speichern unter…", en: "Save as…", uk: "Зберегти як…" },
  "Скачать резервную копию…": { de: "Sicherungskopie herunterladen…", en: "Download backup…", uk: "Завантажити резервну копію…" },
  "Восстановление…": { de: "Wiederherstellung…", en: "Recovery…", uk: "Відновлення…" },
  "Ссылка для совместной работы…": { de: "Link zur Zusammenarbeit…", en: "Collaboration link…", uk: "Посилання для спільної роботи…" },
  "Поделиться для совместной работы…": { de: "Zur Zusammenarbeit freigeben…", en: "Share for collaboration…", uk: "Поділитися для спільної роботи…" },
  "Сохранить дизайн как шаблон…": { de: "Design als Vorlage speichern…", en: "Save design as template…", uk: "Зберегти дизайн як шаблон…" },
  "Создать копию для другого года…": { de: "Kopie für ein anderes Jahr erstellen…", en: "Create a copy for another year…", uk: "Створити копію для іншого року…" },
  "Экспортировать печатный PDF…": { de: "Druck-PDF exportieren…", en: "Export print PDF…", uk: "Експортувати PDF для друку…" },
  "Настройки программы…": { de: "Programmeinstellungen…", en: "Program settings…", uk: "Налаштування програми…" },

  "Отменить": { de: "Rückgängig", en: "Undo", uk: "Скасувати" },
  "Повторить": { de: "Wiederholen", en: "Redo", uk: "Повторити" },
  "Дублировать": { de: "Duplizieren", en: "Duplicate", uk: "Дублювати" },
  "Удалить": { de: "Löschen", en: "Delete", uk: "Видалити" },
  "Сделать выбранный месяц мастер-страницей": { de: "Gewählten Monat als Musterseite verwenden", en: "Use selected month as master page", uk: "Зробити вибраний місяць майстер-сторінкою" },
  "Создать календарь: обложка + 12 месяцев": { de: "Kalender erstellen: Umschlag + 12 Monate", en: "Create calendar: cover + 12 months", uk: "Створити календар: обкладинка + 12 місяців" },
  "Добавить обложку": { de: "Umschlag hinzufügen", en: "Add cover", uk: "Додати обкладинку" },
  "Добавить страницу месяца": { de: "Monatsseite hinzufügen", en: "Add month page", uk: "Додати сторінку місяця" },
  "Удалить текущую страницу": { de: "Aktuelle Seite löschen", en: "Delete current page", uk: "Видалити поточну сторінку" },

  "На самый верх": { de: "Ganz nach vorne", en: "Bring to front", uk: "На самий верх" },
  "На самый низ": { de: "Ganz nach hinten", en: "Send to back", uk: "На самий низ" },
  "Объединить слои в папку": { de: "Ebenen gruppieren", en: "Group layers", uk: "Об’єднати шари в папку" },
  "Выровнять по левому краю": { de: "Linksbündig ausrichten", en: "Align left", uk: "Вирівняти ліворуч" },
  "Выровнять по центру горизонтально": { de: "Horizontal zentrieren", en: "Align horizontal center", uk: "Вирівняти по центру горизонтально" },
  "Выровнять по правому краю": { de: "Rechtsbündig ausrichten", en: "Align right", uk: "Вирівняти праворуч" },
  "Выровнять по верхнему краю": { de: "Oben ausrichten", en: "Align top", uk: "Вирівняти по верхньому краю" },
  "Выровнять по центру вертикально": { de: "Vertikal zentrieren", en: "Align vertical center", uk: "Вирівняти по центру вертикально" },
  "Выровнять по нижнему краю": { de: "Unten ausrichten", en: "Align bottom", uk: "Вирівняти по нижньому краю" },
  "Распределить по горизонтали": { de: "Horizontal verteilen", en: "Distribute horizontally", uk: "Розподілити горизонтально" },
  "Распределить по вертикали": { de: "Vertikal verteilen", en: "Distribute vertically", uk: "Розподілити вертикально" },
  "Блокировать / разблокировать": { de: "Sperren / entsperren", en: "Lock / unlock", uk: "Заблокувати / розблокувати" },
  "Показать / скрыть": { de: "Einblenden / ausblenden", en: "Show / hide", uk: "Показати / приховати" },
  "Полужирный": { de: "Fett", en: "Bold", uk: "Напівжирний" },
  "Курсив": { de: "Kursiv", en: "Italic", uk: "Курсив" },
  "По левому краю": { de: "Linksbündig", en: "Left", uk: "Ліворуч" },
  "По центру": { de: "Zentriert", en: "Center", uk: "По центру" },
  "По правому краю": { de: "Rechtsbündig", en: "Right", uk: "Праворуч" },
  "Направляющие": { de: "Hilfslinien", en: "Guides", uk: "Напрямні" },
  "Увеличить": { de: "Vergrößern", en: "Zoom in", uk: "Збільшити" },
  "Уменьшить": { de: "Verkleinern", en: "Zoom out", uk: "Зменшити" },
  "Страница целиком": { de: "Ganze Seite", en: "Fit page", uk: "Сторінка повністю" },
  "Инструменты": { de: "Werkzeuge", en: "Tools", uk: "Інструменти" },
  "Свойства": { de: "Eigenschaften", en: "Properties", uk: "Властивості" },
  "Библиотека элементов": { de: "Elementbibliothek", en: "Element library", uk: "Бібліотека елементів" },
  "Слои": { de: "Ebenen", en: "Layers", uk: "Шари" },
  "Шаблоны": { de: "Vorlagen", en: "Templates", uk: "Шаблони" },
  "Страницы": { de: "Seiten", en: "Pages", uk: "Сторінки" },
  "События монастыря": { de: "Klostertermine", en: "Monastery events", uk: "Події монастиря" },
  "Предпечатная проверка": { de: "Druckvorstufenprüfung", en: "Preflight", uk: "Переддрукарська перевірка" },
  "Показать все панели": { de: "Alle Bedienfelder anzeigen", en: "Show all panels", uk: "Показати всі панелі" },
  "Скрыть все панели": { de: "Alle Bedienfelder ausblenden", en: "Hide all panels", uk: "Приховати всі панелі" },
  "Как пользоваться?": { de: "Wie funktioniert es?", en: "How to use it", uk: "Як користуватися?" },
  "Горячие клавиши…": { de: "Tastenkürzel…", en: "Keyboard shortcuts…", uk: "Гарячі клавіші…" },
  "О программе": { de: "Über das Programm", en: "About", uk: "Про програму" },

  "Настройки программы": { de: "Programmeinstellungen", en: "Program settings", uk: "Налаштування програми" },
  "Язык интерфейса": { de: "Sprache der Benutzeroberfläche", en: "Interface language", uk: "Мова інтерфейсу" },
  "Язык интерфейса можно выбрать на стартовой странице или в меню Файл → Настройки программы…. Он меняет меню, кнопки, подсказки и окна, но не язык печатного календаря.": {
    de: "Die Oberflächensprache kann auf der Startseite oder unter Datei → Programmeinstellungen… gewählt werden. Sie ändert Menüs, Schaltflächen, Hinweise und Dialoge, nicht aber die Sprache des gedruckten Kalenders.",
    en: "Choose the interface language on the start page or under File → Program settings…. It changes menus, buttons, hints and dialogs, but not the printed calendar language.",
    uk: "Мову інтерфейсу можна вибрати на стартовій сторінці або в меню Файл → Налаштування програми…. Вона змінює меню, кнопки, підказки та вікна, але не мову друкованого календаря.",
  },
  "Эта настройка меняет только меню, подсказки и окна программы. Язык печатного календаря выбирается отдельно в свойствах календаря.": {
    de: "Diese Einstellung ändert nur Menüs, Hinweise und Dialoge. Die Sprache des gedruckten Kalenders wird separat in den Kalendereigenschaften gewählt.",
    en: "This setting changes only menus, hints and dialogs. Choose the printed calendar language separately in Calendar properties.",
    uk: "Це налаштування змінює лише меню, підказки та вікна програми. Мову друкованого календаря вибирають окремо у властивостях календаря.",
  },
  "Выберите его в панели «Свойства», когда не выделен объект. Эта настройка меняет названия месяцев и дней недели, церковные праздники, постные обозначения и имена святых в редакторе и PDF. Она сохраняется вместе с календарём и применяется по ссылке совместной работы.": {
    de: "Wählen Sie sie im Bedienfeld „Eigenschaften“, wenn kein Objekt ausgewählt ist. Diese Einstellung ändert Monats- und Wochentagsnamen, kirchliche Feste, Fastenangaben und Heiligennamen im Editor und im PDF. Sie wird mit dem Kalender gespeichert und gilt auch über den Link zur Zusammenarbeit.",
    en: "Choose it in Properties when no object is selected. It changes month and weekday names, Church feasts, fasting labels and saints’ names in the editor and PDF. It is saved with the calendar and also applies through a collaboration link.",
    uk: "Виберіть її на панелі «Властивості», коли жоден об’єкт не виділено. Це налаштування змінює назви місяців і днів тижня, церковні свята, позначення посту та імена святих у редакторі й PDF. Воно зберігається разом із календарем і діє за посиланням для спільної роботи.",
  },
  "Настройка сохранена на этом компьютере.": {
    de: "Die Einstellung wurde auf diesem Computer gespeichert.",
    en: "The setting is saved on this computer.",
    uk: "Налаштування збережено на цьому комп’ютері.",
  },
  "Настройка сохранена для подтверждённого пользователя и этого календаря. Она также применяется при открытии общей ссылки.": {
    de: "Die Einstellung wird für den bestätigten Benutzer und diesen Kalender gespeichert. Sie gilt auch beim Öffnen des gemeinsamen Links.",
    en: "The setting is saved for the verified user and this calendar. It also applies when the shared link is opened.",
    uk: "Налаштування збережено для підтвердженого користувача й цього календаря. Воно також застосовується під час відкриття спільного посилання.",
  },
  "Готово": { de: "Fertig", en: "Done", uk: "Готово" },
  "Закрыть": { de: "Schließen", en: "Close", uk: "Закрити" },
  "Отмена": { de: "Abbrechen", en: "Cancel", uk: "Скасувати" },
  "Применить": { de: "Anwenden", en: "Apply", uk: "Застосувати" },
  "Открыть": { de: "Öffnen", en: "Open", uk: "Відкрити" },
  "Продолжить": { de: "Fortsetzen", en: "Continue", uk: "Продовжити" },
  "Создать календарь": { de: "Kalender erstellen", en: "Create calendar", uk: "Створити календар" },
  "Продолжить работу": { de: "Arbeit fortsetzen", en: "Continue working", uk: "Продовжити роботу" },
  "Открыть календарь…": { de: "Kalender öffnen…", en: "Open calendar…", uk: "Відкрити календар…" },

  "Календарная мастерская": { de: "Kalenderwerkstatt", en: "Calendar Workshop", uk: "Календарна майстерня" },
  "Создайте православный календарь, готовый к печати": {
    de: "Erstellen Sie einen druckfertigen orthodoxen Kalender",
    en: "Create a print-ready Orthodox calendar",
    uk: "Створіть православний календар, готовий до друку",
  },
  "Создайте обложку и страницы на каждый месяц, добавьте праздники, посты, фотографии и оформление — и получите готовый PDF для печати.": {
    de: "Gestalten Sie Umschlag und Monatsseiten, fügen Sie Feste, Fastenzeiten, Fotos und Schmuck hinzu – und erhalten Sie ein druckfertiges PDF.",
    en: "Design a cover and monthly pages, add feasts, fasts, photos and decoration, then export a print-ready PDF.",
    uk: "Створіть обкладинку та сторінки на кожен місяць, додайте свята, пости, фотографії й оформлення — та отримайте готовий PDF для друку.",
  },
  "ВАШИ КАЛЕНДАРИ": { de: "IHRE KALENDER", en: "YOUR CALENDARS", uk: "ВАШІ КАЛЕНДАРІ" },
  "Последний календарь": { de: "Letzter Kalender", en: "Last calendar", uk: "Останній календар" },
  "Сохранён на этом компьютере": { de: "Auf diesem Computer gespeichert", en: "Saved on this computer", uk: "Збережено на цьому комп’ютері" },
  "Совместная версия": { de: "Gemeinsame Version", en: "Shared version", uk: "Спільна версія" },
  "Онлайн-версия · доступна по ссылке": { de: "Online-Version · über Link verfügbar", en: "Online version · available by link", uk: "Онлайн-версія · доступна за посиланням" },
  "Открыть календарь с компьютера": { de: "Kalender vom Computer öffnen", en: "Open a calendar from this computer", uk: "Відкрити календар із комп’ютера" },
  "Выберите ранее сохранённый файл календаря": { de: "Wählen Sie eine zuvor gespeicherte Kalenderdatei", en: "Choose a previously saved calendar file", uk: "Виберіть раніше збережений файл календаря" },
  "Точный календарь": { de: "Zuverlässiger Kalender", en: "Accurate calendar", uk: "Точний календар" },
  "Профессиональная вёрстка": { de: "Professionelles Layout", en: "Professional layout", uk: "Професійна верстка" },
  "Совместная работа": { de: "Zusammenarbeit", en: "Collaboration", uk: "Спільна робота" },
  "Для работы с редактором откройте мастерскую на компьютере или на большом экране.": {
    de: "Öffnen Sie die Werkstatt an einem Computer oder auf einem großen Bildschirm, um den Editor zu verwenden.",
    en: "Open the workshop on a computer or large screen to use the editor.",
    uk: "Щоб працювати в редакторі, відкрийте майстерню на комп’ютері або великому екрані.",
  },

  "Общий календарь": { de: "Gemeinsamer Kalender", en: "Shared calendar", uk: "Спільний календар" },
  "Сохранено": { de: "Gespeichert", en: "Saved", uk: "Збережено" },
  "Сохранение…": { de: "Speichern…", en: "Saving…", uk: "Збереження…" },
  "Ошибка сохранения": { de: "Speicherfehler", en: "Save error", uk: "Помилка збереження" },
  "Источник: ММ": { de: "Quelle: MM", en: "Source: MM", uk: "Джерело: ММ" },
  "КНИЖНАЯ": { de: "HOCHFORMAT", en: "PORTRAIT", uk: "КНИЖКОВА" },
  "АЛЬБОМНАЯ": { de: "QUERFORMAT", en: "LANDSCAPE", uk: "АЛЬБОМНА" },
  "мм": { de: "mm", en: "mm", uk: "мм" },

  "Тип": { de: "Typ", en: "Type", uk: "Тип" },
  "Ширина": { de: "Breite", en: "Width", uk: "Ширина" },
  "Высота": { de: "Höhe", en: "Height", uk: "Висота" },
  "Поворот": { de: "Drehung", en: "Rotation", uk: "Поворот" },
  "Непрозрачность, %": { de: "Deckkraft, %", en: "Opacity, %", uk: "Непрозорість, %" },
  "Скругление, мм": { de: "Eckenradius, mm", en: "Corner radius, mm", uk: "Заокруглення, мм" },
  "Заменить файл…": { de: "Datei ersetzen…", en: "Replace file…", uk: "Замінити файл…" },
  "Заполнение": { de: "Einpassung", en: "Fitting", uk: "Заповнення" },
  "Вписать": { de: "Einpassen", en: "Contain", uk: "Вписати" },
  "С обрезкой": { de: "Beschneiden", en: "Crop", uk: "З обрізанням" },
  "Положение кадра": { de: "Bildausschnitt", en: "Frame position", uk: "Положення кадру" },
  "По горизонтали": { de: "Horizontal", en: "Horizontal", uk: "Горизонтально" },
  "По вертикали": { de: "Vertikal", en: "Vertical", uk: "Вертикально" },
  "Месяц": { de: "Monat", en: "Month", uk: "Місяць" },
  "Неделя": { de: "Woche", en: "Week", uk: "Тиждень" },
  "Заголовки дней недели": { de: "Wochentagsüberschriften", en: "Weekday headings", uk: "Заголовки днів тижня" },
  "Названия": { de: "Namen", en: "Names", uk: "Назви" },
  "Полные": { de: "Vollständig", en: "Full", uk: "Повні" },
  "Сокращённые": { de: "Kurz", en: "Short", uk: "Скорочені" },
  "Стиль сетки": { de: "Rasterstil", en: "Grid style", uk: "Стиль сітки" },
  "Формат": { de: "Format", en: "Format", uk: "Формат" },
  "Книжная": { de: "Hochformat", en: "Portrait", uk: "Книжкова" },
  "Альбомная": { de: "Querformat", en: "Landscape", uk: "Альбомна" },
  "Название проекта": { de: "Projektname", en: "Project name", uk: "Назва проєкту" },
  "Календарный год": { de: "Kalenderjahr", en: "Calendar year", uk: "Календарний рік" },
  "Язык календаря": { de: "Kalendersprache", en: "Calendar language", uk: "Мова календаря" },
  "Язык месяцев, дней недели, праздников, постов и имён святых. Он не зависит от языка программы.": { de: "Sprache der Monate, Wochentage, Feste, Fastenzeiten und Heiligennamen. Sie ist unabhängig von der Programmsprache.", en: "Language for months, weekdays, feasts, fasting and saints’ names. It is independent of the program language.", uk: "Мова назв місяців, днів тижня, свят, постів та імен святих. Вона не залежить від мови програми." },
  "Правила поста": { de: "Fastenregeln", en: "Fasting rules", uk: "Правила посту" },
  "Издатель / монастырь": { de: "Herausgeber / Kloster", en: "Publisher / monastery", uk: "Видавець / монастир" },
  "ШРИФТЫ ПРОЕКТА": { de: "PROJEKTSCHRIFTEN", en: "PROJECT FONTS", uk: "ШРИФТИ ПРОЄКТУ" },
  "Добавить шрифт…": { de: "Schrift hinzufügen…", en: "Add font…", uk: "Додати шрифт…" },
  "Дополнительные даты и события…": { de: "Zusätzliche Daten und Termine…", en: "Additional dates and events…", uk: "Додаткові дати та події…" },
  "Размер и служебные зоны": { de: "Größe und Hilfsbereiche", en: "Size and service areas", uk: "Розмір і службові зони" },
  "Единицы": { de: "Einheiten", en: "Units", uk: "Одиниці" },

  "ЭЛЕМЕНТЫ": { de: "ELEMENTE", en: "ELEMENTS", uk: "ЕЛЕМЕНТИ" },
  "БИБЛИОТЕКА ЭЛЕМЕНТОВ": { de: "ELEMENTBIBLIOTHEK", en: "ELEMENT LIBRARY", uk: "БІБЛІОТЕКА ЕЛЕМЕНТІВ" },
  "Золотые": { de: "Gold", en: "Gold", uk: "Золоті" },
  "Поиск": { de: "Suche", en: "Search", uk: "Пошук" },
  "Раздел": { de: "Kategorie", en: "Category", uk: "Розділ" },
  "Все элементы": { de: "Alle Elemente", en: "All elements", uk: "Усі елементи" },
  "СЛОИ": { de: "EBENEN", en: "LAYERS", uk: "ШАРИ" },
  "СТРАНИЦЫ": { de: "SEITEN", en: "PAGES", uk: "СТОРІНКИ" },
  "СОБЫТИЯ": { de: "TERMINE", en: "EVENTS", uk: "ПОДІЇ" },
  "Добавить": { de: "Hinzufügen", en: "Add", uk: "Додати" },
  "Изменить": { de: "Ändern", en: "Change", uk: "Змінити" },
  "Переименовать": { de: "Umbenennen", en: "Rename", uk: "Перейменувати" },
  "Вверх": { de: "Nach oben", en: "Up", uk: "Вгору" },
  "Вниз": { de: "Nach unten", en: "Down", uk: "Вниз" },
  "Заблокировать": { de: "Sperren", en: "Lock", uk: "Заблокувати" },
  "Разблокировать": { de: "Entsperren", en: "Unlock", uk: "Розблокувати" },
  "Показать": { de: "Anzeigen", en: "Show", uk: "Показати" },
  "Скрыть": { de: "Ausblenden", en: "Hide", uk: "Приховати" },
  "Проверка": { de: "Prüfung", en: "Check", uk: "Перевірка" },
  "ошибок": { de: "Fehler", en: "errors", uk: "помилок" },
  "Издательский онлайн‑инструмент монастыря": { de: "Online-Publikationswerkzeug des Klosters", en: "The monastery’s online publishing tool", uk: "Видавничий онлайн-інструмент монастиря" },
  "Продолжить последний": { de: "Letzten fortsetzen", en: "Continue last calendar", uk: "Продовжити останній" },
  "Возможности": { de: "Funktionen", en: "Features", uk: "Можливості" },
  "Даты, праздники, посты и монастырские события.": { de: "Daten, Feste, Fastenzeiten und Klostertermine.", en: "Dates, feasts, fasts and monastery events.", uk: "Дати, свята, пости та монастирські події." },
  "Свободная вёрстка": { de: "Freies Layout", en: "Flexible layout", uk: "Вільна верстка" },
  "Страницы, слои, фотографии, текст и золотой декор.": { de: "Seiten, Ebenen, Fotos, Text und Goldschmuck.", en: "Pages, layers, photos, text and gold decoration.", uk: "Сторінки, шари, фотографії, текст і золотий декор." },
  "Передайте ссылку другому человеку, чтобы вместе подготовить календарь.": { de: "Senden Sie den Link an eine andere Person, um den Kalender gemeinsam vorzubereiten.", en: "Send the link to another person to prepare the calendar together.", uk: "Надішліть посилання іншій людині, щоб разом підготувати календар." },
  "Готово к печати": { de: "Druckfertig", en: "Print ready", uk: "Готово до друку" },
  "Скачайте готовый PDF и передайте его в типографию.": { de: "Laden Sie das fertige PDF herunter und geben Sie es an die Druckerei weiter.", en: "Download the finished PDF and send it to the printer.", uk: "Завантажте готовий PDF і передайте його до друкарні." },
  "О проекте": { de: "Über das Projekt", en: "About the project", uk: "Про проєкт" },
  "Онлайн‑инструмент для подготовки православных календарей: от церковных дат и постов до собственной вёрстки и печатного PDF.": { de: "Ein Online-Werkzeug für orthodoxe Kalender: von kirchlichen Daten und Fastenzeiten bis zum eigenen Layout und druckfertigen PDF.", en: "An online tool for Orthodox calendars, from church dates and fasts to custom layout and a print-ready PDF.", uk: "Онлайн-інструмент для підготовки православних календарів: від церковних дат і постів до власної верстки та PDF для друку." },
  "Свято‑Георгиевский мужской монастырь": { de: "Orthodoxes Männerkloster St. Georg", en: "St George Orthodox Monastery", uk: "Свято-Георгіївський чоловічий монастир" },
  "Проект монастыря Берлинской епархии в Гётчендорфе.": { de: "Ein Projekt des Klosters der Berliner Diözese in Götschendorf.", en: "A project of the Berlin Diocese monastery in Götschendorf.", uk: "Проєкт монастиря Берлінської єпархії в Гетчендорфі." },
  "Разработка и связь": { de: "Entwicklung und Kontakt", en: "Development and contact", uk: "Розробка та зв’язок" },
  "Мои календари": { de: "Meine Kalender", en: "My calendars", uk: "Мої календарі" },
  "Последняя работа · сохранена на этом компьютере": { de: "Letzte Arbeit · auf diesem Computer gespeichert", en: "Last work · saved on this computer", uk: "Остання робота · збережена на цьому комп’ютері" },
  "Совместная версия · доступна по ссылке": { de: "Gemeinsame Version · über Link verfügbar", en: "Shared version · available by link", uk: "Спільна версія · доступна за посиланням" },
  "Проект Свято‑Георгиевского мужского монастыря": { de: "Projekt des orthodoxen Männerklosters St. Georg", en: "A project of St George Orthodox Monastery", uk: "Проєкт Свято-Георгіївського чоловічого монастиря" },
  "Для работы нужен большой экран": { de: "Für die Arbeit ist ein großer Bildschirm erforderlich", en: "A large screen is required", uk: "Для роботи потрібен великий екран" },
  "Создание и редактирование календаря рассчитано на компьютер или устройство с большим экраном.": { de: "Das Erstellen und Bearbeiten des Kalenders ist für einen Computer oder ein Gerät mit großem Bildschirm ausgelegt.", en: "Creating and editing a calendar is designed for a computer or another large-screen device.", uk: "Створення та редагування календаря розраховане на комп’ютер або пристрій із великим екраном." },
  "Откройте, пожалуйста, эту же страницу или полученную ссылку на компьютере.": { de: "Bitte öffnen Sie diese Seite oder den erhaltenen Link auf einem Computer.", en: "Please open this page or the link you received on a computer.", uk: "Будь ласка, відкрийте цю сторінку або отримане посилання на комп’ютері." },
  "Понятно": { de: "Verstanden", en: "Got it", uk: "Зрозуміло" },

  "Первый календарь": { de: "Erster Kalender", en: "First calendar", uk: "Перший календар" },
  "Подтверждение e-mail": { de: "E-Mail-Bestätigung", en: "Email verification", uk: "Підтвердження e-mail" },
  "Подтвердите e-mail": { de: "E-Mail bestätigen", en: "Verify your email", uk: "Підтвердьте e-mail" },
  "Ссылка действует 30 минут. Эту вкладку можно закрыть.": { de: "Der Link ist 30 Minuten gültig. Sie können diesen Tab schließen.", en: "The link is valid for 30 minutes. You may close this tab.", uk: "Посилання діє 30 хвилин. Цю вкладку можна закрити." },
  "Открыть тестовую ссылку подтверждения": { de: "Test-Bestätigungslink öffnen", en: "Open test verification link", uk: "Відкрити тестове посилання підтвердження" },
  "Мы запрашиваем адрес один раз. Он нужен только для подтверждения, что календарь создаёт человек, и для серверного экспорта PDF.": { de: "Wir fragen die Adresse einmalig ab. Sie dient nur zur Bestätigung und für den PDF-Export über den Server.", en: "We ask for the address once. It is used only for verification and server-side PDF export.", uk: "Ми запитуємо адресу один раз. Вона потрібна лише для підтвердження та серверного експорту PDF." },
  "Отправляем…": { de: "Wird gesendet…", en: "Sending…", uk: "Надсилаємо…" },
  "Получить ссылку": { de: "Link erhalten", en: "Get link", uk: "Отримати посилання" },

  "Не удалось открыть": { de: "Öffnen fehlgeschlagen", en: "Could not open", uk: "Не вдалося відкрити" },
  "Открываем календарь…": { de: "Kalender wird geöffnet…", en: "Opening calendar…", uk: "Відкриваємо календар…" },
  "Календарь сейчас занят": { de: "Der Kalender wird gerade bearbeitet", en: "The calendar is currently in use", uk: "Календар зараз зайнятий" },
  "Загружаем проект и проверяем право редактирования.": { de: "Das Projekt wird geladen und der Bearbeitungszugriff geprüft.", en: "Loading the project and checking edit access.", uk: "Завантажуємо проєкт і перевіряємо право редагування." },
  "На главную": { de: "Zur Startseite", en: "Home", uk: "На головну" },
  "Другой редактор": { de: "Andere Person", en: "Another editor", uk: "Інший редактор" },
  "Ждём освобождения и проверяем автоматически…": { de: "Wir warten und prüfen automatisch…", en: "Waiting and checking automatically…", uk: "Чекаємо на звільнення та перевіряємо автоматично…" },
  "Сделать копию": { de: "Kopie erstellen", en: "Make a copy", uk: "Зробити копію" },
  "Подождать": { de: "Warten", en: "Wait", uk: "Зачекати" },
  "Проверить сейчас": { de: "Jetzt prüfen", en: "Check now", uk: "Перевірити зараз" },
  "Ссылка на календарь": { de: "Kalenderlink", en: "Calendar link", uk: "Посилання на календар" },
  "PDF готов": { de: "PDF ist fertig", en: "PDF is ready", uk: "PDF готовий" },
  "Серверный экспорт": { de: "Serverexport", en: "Server export", uk: "Серверний експорт" },
  "Ссылка на календарь готова": { de: "Kalenderlink ist fertig", en: "Calendar link is ready", uk: "Посилання на календар готове" },
  "PDF сохранён на сервере": { de: "PDF wurde auf dem Server gespeichert", en: "PDF saved on the server", uk: "PDF збережено на сервері" },
  "Отправьте эту ссылку другому человеку. Пока вы работаете, он сможет подождать или создать независимую копию.": { de: "Senden Sie diesen Link an eine andere Person. Während Sie arbeiten, kann sie warten oder eine unabhängige Kopie erstellen.", en: "Send this link to another person. While you work, they can wait or create an independent copy.", uk: "Надішліть це посилання іншій людині. Поки ви працюєте, вона зможе зачекати або створити незалежну копію." },
  "Скачивание можно повторить или продолжить после разрыва соединения по этой ссылке.": { de: "Über diesen Link kann der Download nach einer Unterbrechung wiederholt oder fortgesetzt werden.", en: "Use this link to retry or resume the download after a connection interruption.", uk: "За цим посиланням завантаження можна повторити або продовжити після розриву з’єднання." },
  "Ссылка": { de: "Link", en: "Link", uk: "Посилання" },
  "Копировать ссылку": { de: "Link kopieren", en: "Copy link", uk: "Копіювати посилання" },
  "Скачать PDF": { de: "PDF herunterladen", en: "Download PDF", uk: "Завантажити PDF" },
  "Открыть ссылку": { de: "Link öffnen", en: "Open link", uk: "Відкрити посилання" },

  "Восстановление проекта": { de: "Projektwiederherstellung", en: "Project recovery", uk: "Відновлення проєкту" },
  "Файл проекта": { de: "Projektdatei", en: "Project file", uk: "Файл проєкту" },
  "Восстановление": { de: "Wiederherstellung", en: "Recovery", uk: "Відновлення" },
  "Выберите локальную резервную точку. На кнопке показаны только дата и время; описание доступно при наведении.": { de: "Wählen Sie einen lokalen Wiederherstellungspunkt. Die Schaltfläche zeigt Datum und Uhrzeit; die Beschreibung erscheint beim Darüberfahren.", en: "Choose a local recovery point. The button shows its date and time; hover to see the description.", uk: "Виберіть локальну точку відновлення. На кнопці показано дату й час; опис доступний при наведенні." },
  "Восстановить": { de: "Wiederherstellen", en: "Restore", uk: "Відновити" },
  "Резервных точек пока нет.": { de: "Noch keine Wiederherstellungspunkte.", en: "There are no recovery points yet.", uk: "Точок відновлення поки немає." },
  "Письмо отправлено на": { de: "Die E-Mail wurde gesendet an", en: "Email sent to", uk: "Лист надіслано на" },
  ". Откройте ссылку из письма — пароль и регистрация не нужны.": { de: ". Öffnen Sie den Link in der E-Mail – Passwort und Registrierung sind nicht erforderlich.", en: ". Open the link in the email—no password or registration is required.", uk: ". Відкрийте посилання з листа — пароль і реєстрація не потрібні." },
  "открыл этот документ. Одновременное редактирование выключено, чтобы изменения не перезаписывали друг друга.": { de: "hat dieses Dokument geöffnet. Gleichzeitiges Bearbeiten ist deaktiviert, damit Änderungen einander nicht überschreiben.", en: "opened this document. Simultaneous editing is disabled so changes cannot overwrite one another.", uk: "відкрив цей документ. Одночасне редагування вимкнено, щоб зміни не перезаписували одна одну." },

  "Коллекция элементов": { de: "Elementsammlung", en: "Element collection", uk: "Колекція елементів" },
  "Рамка, крест, угол…": { de: "Rahmen, Kreuz, Ecke…", en: "Frame, cross, corner…", uk: "Рамка, хрест, кут…" },
  "По этому запросу элементов нет.": { de: "Keine Elemente für diese Suche.", en: "No elements match this search.", uk: "За цим запитом елементів немає." },
  "Новый пустой слой": { de: "Neue leere Ebene", en: "New empty layer", uk: "Новий порожній шар" },
  "Новая папка": { de: "Neue Gruppe", en: "New group", uk: "Нова папка" },
  "Объединить выбранные слои в папку": { de: "Ausgewählte Ebenen gruppieren", en: "Group selected layers", uk: "Об’єднати вибрані шари в папку" },
  "Удалить выбранное (Delete)": { de: "Auswahl löschen (Entf)", en: "Delete selection (Delete)", uk: "Видалити вибране (Delete)" },
  "Слои страницы": { de: "Seitenebenen", en: "Page layers", uk: "Шари сторінки" },
  "Переместить на самый верх": { de: "Ganz nach vorne verschieben", en: "Move to front", uk: "Перемістити на самий верх" },
  "Переместить на самый низ": { de: "Ganz nach hinten verschieben", en: "Move to back", uk: "Перемістити на самий низ" },
  "Свернуть папку": { de: "Gruppe zuklappen", en: "Collapse group", uk: "Згорнути папку" },
  "Развернуть папку": { de: "Gruppe aufklappen", en: "Expand group", uk: "Розгорнути папку" },
  "Обязательный фирменный знак всегда виден": { de: "Das obligatorische Markenzeichen ist immer sichtbar", en: "The required brand mark is always visible", uk: "Обов’язковий фірмовий знак завжди видимий" },
  "Обязательный фирменный знак всегда заблокирован": { de: "Das obligatorische Markenzeichen ist immer gesperrt", en: "The required brand mark is always locked", uk: "Обов’язковий фірмовий знак завжди заблокований" },
  "К слою применена маска": { de: "Auf die Ebene ist eine Maske angewendet", en: "A mask is applied to the layer", uk: "До шару застосовано маску" },
  "Название слоя или папки": { de: "Name der Ebene oder Gruppe", en: "Layer or group name", uk: "Назва шару або папки" },
  "Маска слоя": { de: "Ebenenmaske", en: "Layer mask", uk: "Маска шару" },
  "Маска включена": { de: "Maske aktiviert", en: "Mask enabled", uk: "Маску ввімкнено" },
  "Взять форму из элемента": { de: "Form aus Element übernehmen", en: "Use shape from element", uk: "Взяти форму з елемента" },
  "изображение": { de: "Bild", en: "image", uk: "зображення" },
  "Будет скопирован в маску слоя": { de: "Wird in die Ebenenmaske kopiert", en: "Will be copied to the layer mask", uk: "Буде скопійовано до маски шару" },
  "Применить элемент как маску": { de: "Element als Maske anwenden", en: "Apply element as mask", uk: "Застосувати елемент як маску" },
  "Загрузить чёрно-белую маску…": { de: "Schwarzweißmaske laden…", en: "Load black-and-white mask…", uk: "Завантажити чорно-білу маску…" },
  "Удалить маску со слоя": { de: "Ebenenmaske entfernen", en: "Remove layer mask", uk: "Видалити маску з шару" },
  "Белое показывает слой, чёрное скрывает, серое делает его полупрозрачным. Исходный объект не изменяется.": { de: "Weiß zeigt die Ebene, Schwarz blendet sie aus und Grau macht sie halbtransparent. Das ursprüngliche Objekt bleibt unverändert.", en: "White reveals the layer, black hides it, and grey makes it translucent. The original object is unchanged.", uk: "Біле показує шар, чорне приховує, сіре робить його напівпрозорим. Початковий об’єкт не змінюється." },
  "Слой заблокирован — сначала разблокируйте его.": { de: "Die Ebene ist gesperrt – entsperren Sie sie zuerst.", en: "The layer is locked—unlock it first.", uk: "Шар заблоковано — спочатку розблокуйте його." },
  "Ctrl/⌘ — несколько слоёв. Shift при переносе — не вкладывать в папку.": { de: "Ctrl/⌘ – mehrere Ebenen. Shift beim Verschieben – nicht in eine Gruppe legen.", en: "Ctrl/⌘ selects multiple layers. Hold Shift while moving to avoid nesting in a group.", uk: "Ctrl/⌘ — кілька шарів. Shift під час перенесення — не вкладати в папку." },

  "Выделение": { de: "Auswahl", en: "Selection", uk: "Виділення" },
  "Текстовый блок": { de: "Textfeld", en: "Text box", uk: "Текстовий блок" },
  "Изображение": { de: "Bild", en: "Image", uk: "Зображення" },
  "Прямоугольник": { de: "Rechteck", en: "Rectangle", uk: "Прямокутник" },
  "Эллипс": { de: "Ellipse", en: "Ellipse", uk: "Еліпс" },
  "Линия": { de: "Linie", en: "Line", uk: "Лінія" },
  "SVG и декор": { de: "SVG und Dekor", en: "SVG and decoration", uk: "SVG і декор" },
  "Календарная сетка": { de: "Kalenderraster", en: "Calendar grid", uk: "Календарна сітка" },
  "Рука": { de: "Hand", en: "Hand", uk: "Рука" },
  "Масштаб": { de: "Zoom", en: "Zoom", uk: "Масштаб" },
  "Шаблоны календаря": { de: "Kalendervorlagen", en: "Calendar templates", uk: "Шаблони календаря" },
  "Поменять заливку и обводку местами": { de: "Füllung und Kontur vertauschen", en: "Swap fill and stroke", uk: "Поміняти місцями заливку й обведення" },
  "Цвета по умолчанию": { de: "Standardfarben", en: "Default colours", uk: "Типові кольори" },
  "Золотой цвет / золотой градиент": { de: "Goldfarbe / Goldverlauf", en: "Gold colour / gold gradient", uk: "Золотий колір / золотий градієнт" },
  "Цвет заливки": { de: "Füllfarbe", en: "Fill colour", uk: "Колір заливки" },
  "Цвет обводки": { de: "Konturfarbe", en: "Stroke colour", uk: "Колір обведення" },
  "Стиль": { de: "Stil", en: "Style", uk: "Стиль" },
  "Набор картинок": { de: "Bildsatz", en: "Image set", uk: "Набір зображень" },
  "На стартовую страницу": { de: "Zur Startseite", en: "Go to start page", uk: "На стартову сторінку" },
  "Контекстные параметры": { de: "Kontextparameter", en: "Context controls", uk: "Контекстні параметри" },
  "Открытые страницы": { de: "Geöffnete Seiten", en: "Open pages", uk: "Відкриті сторінки" },
  "Нет открытых страниц": { de: "Keine geöffneten Seiten", en: "No open pages", uk: "Немає відкритих сторінок" },
  "Все вкладки закрыты": { de: "Alle Tabs sind geschlossen", en: "All tabs are closed", uk: "Усі вкладки закрито" },
  "Страницы календаря не удалены. Выберите нужную страницу в списке справа.": { de: "Die Kalenderseiten wurden nicht gelöscht. Wählen Sie rechts die gewünschte Seite aus.", en: "The calendar pages have not been deleted. Choose a page from the list on the right.", uk: "Сторінки календаря не видалено. Виберіть потрібну сторінку у списку праворуч." },
  "Открыть список страниц": { de: "Seitenliste öffnen", en: "Open page list", uk: "Відкрити список сторінок" },
  "Изменить ширину правой панели": { de: "Breite des rechten Bedienfelds ändern", en: "Resize right panel", uk: "Змінити ширину правої панелі" },
  "Потяните для изменения ширины; двойной щелчок — исходная ширина": { de: "Ziehen zum Ändern; Doppelklick setzt die Breite zurück", en: "Drag to resize; double-click to reset", uk: "Потягніть, щоб змінити ширину; подвійне клацання — початкова ширина" },
  "Панели документа": { de: "Dokumentbedienfelder", en: "Document panels", uk: "Панелі документа" },
  "Страница": { de: "Seite", en: "Page", uk: "Сторінка" },
  "Геометрия": { de: "Geometrie", en: "Geometry", uk: "Геометрія" },
  "Внешний вид": { de: "Darstellung", en: "Appearance", uk: "Вигляд" },
  "Непрозрачность объекта": { de: "Deckkraft des Objekts", en: "Object opacity", uk: "Непрозорість об’єкта" },
  "4 угла": { de: "4 Ecken", en: "4 corners", uk: "4 кути" },
  "Связать углы: использовать значение верхнего левого угла": { de: "Ecken verknüpfen: Wert der linken oberen Ecke verwenden", en: "Link corners using the top-left value", uk: "Зв’язати кути: використати значення верхнього лівого кута" },
  "Настроить каждый угол отдельно": { de: "Jede Ecke einzeln einstellen", en: "Adjust each corner separately", uk: "Налаштувати кожен кут окремо" },
  "Связать скругления углов": { de: "Eckenradien verknüpfen", en: "Link corner radii", uk: "Зв’язати заокруглення кутів" },
  "Разделить скругления углов": { de: "Eckenradien trennen", en: "Unlink corner radii", uk: "Розділити заокруглення кутів" },
  "Верхний левый": { de: "Oben links", en: "Top left", uk: "Верхній лівий" },
  "Верхний правый": { de: "Oben rechts", en: "Top right", uk: "Верхній правий" },
  "Нижний левый": { de: "Unten links", en: "Bottom left", uk: "Нижній лівий" },
  "Нижний правый": { de: "Unten rechts", en: "Bottom right", uk: "Нижній правий" },
  "Текст месяца": { de: "Monatstext", en: "Month text", uk: "Текст місяця" },
  "Автор / источник": { de: "Autor / Quelle", en: "Author / source", uk: "Автор / джерело" },
  "Шрифт": { de: "Schrift", en: "Font", uk: "Шрифт" },
  "Размер, pt": { de: "Größe, pt", en: "Size, pt", uk: "Розмір, pt" },
  "Начертание": { de: "Schriftschnitt", en: "Weight", uk: "Накреслення" },
  "Обычное": { de: "Normal", en: "Regular", uk: "Звичайне" },
  "Полужирное": { de: "Fett", en: "Bold", uk: "Напівжирне" },
  "Прямой": { de: "Normal", en: "Roman", uk: "Прямий" },
  "Интерлиньяж": { de: "Zeilenabstand", en: "Line height", uk: "Інтерліньяж" },
  "Трекинг, pt": { de: "Laufweite, pt", en: "Tracking, pt", uk: "Трекінг, pt" },
  "Отступ, мм": { de: "Innenabstand, mm", en: "Padding, mm", uk: "Відступ, мм" },
  "Цвет": { de: "Farbe", en: "Colour", uk: "Колір" },
  "Золотой цвет": { de: "Goldfarbe", en: "Gold colour", uk: "Золотий колір" },
  "Эффекты крупного заголовка": { de: "Effekte für große Überschrift", en: "Large heading effects", uk: "Ефекти великого заголовка" },
  "Выравнивание": { de: "Ausrichtung", en: "Alignment", uk: "Вирівнювання" },
  "Слева": { de: "Links", en: "Left", uk: "Ліворуч" },
  "Справа": { de: "Rechts", en: "Right", uk: "Праворуч" },
  "По ширине": { de: "Blocksatz", en: "Justify", uk: "По ширині" },
  "Сверху": { de: "Oben", en: "Top", uk: "Зверху" },
  "Снизу": { de: "Unten", en: "Bottom", uk: "Знизу" },
  "Обязательный фирменный знак": { de: "Obligatorisches Markenzeichen", en: "Required brand mark", uk: "Обов’язковий фірмовий знак" },
  "Всегда виден и находится на самом верхнем слое.": { de: "Immer sichtbar und auf der obersten Ebene.", en: "Always visible and kept on the top layer.", uk: "Завжди видимий і розташований на найвищому шарі." },
  "Выбрать файл…": { de: "Datei auswählen…", en: "Choose file…", uk: "Вибрати файл…" },
  "Растянуть": { de: "Strecken", en: "Stretch", uk: "Розтягнути" },
  "Цвет SVG": { de: "SVG-Farbe", en: "SVG colour", uk: "Колір SVG" },
  "Золотой цвет SVG": { de: "Goldfarbe für SVG", en: "Gold SVG colour", uk: "Золотий колір SVG" },
  "Векторный элемент из библиотеки: цвет меняется без потери качества.": { de: "Vektorelement aus der Bibliothek: Die Farbe ändert sich ohne Qualitätsverlust.", en: "Vector element from the library: colour changes without loss of quality.", uk: "Векторний елемент із бібліотеки: колір змінюється без втрати якості." },
  "Недель": { de: "Wochen", en: "Weeks", uk: "Тижнів" },
  "Короткие": { de: "Kurz", en: "Short", uk: "Короткі" },
  "Свои": { de: "Benutzerdefiniert", en: "Custom", uk: "Власні" },
  "Издательская": { de: "Editorial", en: "Editorial", uk: "Видавнича" },
  "Табличная": { de: "Tabellarisch", en: "Boxed", uk: "Таблична" },
  "Без линий": { de: "Ohne Linien", en: "No lines", uk: "Без ліній" },
  "Шрифт заголовков": { de: "Schrift der Überschriften", en: "Heading font", uk: "Шрифт заголовків" },
  "Заголовки, pt": { de: "Überschriften, pt", en: "Headings, pt", uk: "Заголовки, pt" },
  "Эффекты названий дней недели": { de: "Effekte für Wochentagsnamen", en: "Weekday heading effects", uk: "Ефекти назв днів тижня" },
  "Событий в ячейке": { de: "Termine pro Zelle", en: "Events per cell", uk: "Подій у клітинці" },
  "Состав памятей": { de: "Umfang der Gedenktage", en: "Commemoration set", uk: "Склад пам’ятей" },
  "Пасха, двунадесятые и великие": { de: "Pascha, zwölf große und hohe Feste", en: "Pascha, Twelve Great and major feasts", uk: "Пасха, дванадесяті та великі" },
  "Великие и средние": { de: "Hohe und mittlere Feste", en: "Major and medium", uk: "Великі та середні" },
  "Все допустимые": { de: "Alle zulässigen", en: "All allowed", uk: "Усі допустимі" },
  "Свой выбор": { de: "Eigene Auswahl", en: "Custom selection", uk: "Власний вибір" },
  "Малых памятей в пустой день": { de: "Kleine Gedenktage an leeren Tagen", en: "Minor commemorations on an empty day", uk: "Малих пам’ятей у порожній день" },
  "Шрифт числа": { de: "Schrift der Tageszahl", en: "Day number font", uk: "Шрифт числа" },
  "Размер числа, pt": { de: "Zahlengröße, pt", en: "Number size, pt", uk: "Розмір числа, pt" },
  "Число дня — положение от левого верхнего угла": { de: "Tageszahl – Position von oben links", en: "Day number—position from top left", uk: "Число дня — положення від верхнього лівого кута" },
  "Эффекты числа дня": { de: "Effekte der Tageszahl", en: "Day number effects", uk: "Ефекти числа дня" },
  "Шрифт событий": { de: "Schrift der Ereignisse", en: "Event font", uk: "Шрифт подій" },
  "Текст событий, pt": { de: "Ereignistext, pt", en: "Event text, pt", uk: "Текст подій, pt" },
  "Автоподбор кегля": { de: "Schriftgröße automatisch anpassen", en: "Auto-fit font size", uk: "Автодобір кегля" },
  "Не уменьшать ниже, pt": { de: "Nicht kleiner als, pt", en: "Minimum size, pt", uk: "Не зменшувати нижче, pt" },
  "Автоподбор уменьшает заданный выше кегль только тогда, когда важный текст не помещается.": { de: "Die automatische Anpassung verkleinert die Schrift nur, wenn wichtiger Text nicht passt.", en: "Auto-fit reduces the selected size only when important text does not fit.", uk: "Автодобір зменшує заданий кегль лише тоді, коли важливий текст не вміщується." },
  "Между строками, pt": { de: "Zwischen Zeilen, pt", en: "Line spacing, pt", uk: "Між рядками, pt" },
  "Между событиями, pt": { de: "Zwischen Ereignissen, pt", en: "Event spacing, pt", uk: "Між подіями, pt" },
  "Текст событий — независимая область": { de: "Ereignistext – unabhängiger Bereich", en: "Event text—independent area", uk: "Текст подій — незалежна область" },
  "Поле справа, мм": { de: "Rand rechts, mm", en: "Right inset, mm", uk: "Поле праворуч, мм" },
  "Поле снизу, мм": { de: "Rand unten, mm", en: "Bottom inset, mm", uk: "Поле знизу, мм" },
  "Дата по старому стилю": { de: "Datum nach altem Stil", en: "Old Style date", uk: "Дата за старим стилем" },
  "Цвета праздников": { de: "Festfarben", en: "Feast colours", uk: "Кольори свят" },
  "Включить знаки типикона": { de: "Typikonzeichen anzeigen", en: "Show Typikon marks", uk: "Увімкнути знаки типікону" },
  "Знак типикона": { de: "Typikonzeichen", en: "Typikon mark", uk: "Знак типікону" },
  "Размер, мм": { de: "Größe, mm", en: "Size, mm", uk: "Розмір, мм" },
  "Значки пищи и поста": { de: "Speise- und Fastensymbole", en: "Food and fasting icons", uk: "Значки їжі та посту" },
  "Значок пищи / поста": { de: "Speise-/Fastensymbol", en: "Food / fasting icon", uk: "Значок їжі / посту" },
  "Текстовые записи о посте": { de: "Fastenhinweise als Text", en: "Text fasting notes", uk: "Текстові записи про піст" },
  "Правила венчания": { de: "Trauungsregeln", en: "Marriage rules", uk: "Правила вінчання" },
  "Чтения Священного Писания": { de: "Schriftlesungen", en: "Scripture readings", uk: "Читання Святого Письма" },
  "Применить оформление ко всем месяцам": { de: "Gestaltung auf alle Monate anwenden", en: "Apply styling to all months", uk: "Застосувати оформлення до всіх місяців" },
  "Выбранный набор сразу применяется ко всем месяцам. Легенда показывает только знаки, используемые в выбранном месяце.": { de: "Der gewählte Satz gilt sofort für alle Monate. Die Legende zeigt nur die im gewählten Monat verwendeten Zeichen.", en: "The selected set is applied to every month. The legend shows only the icons used in the selected month.", uk: "Вибраний набір одразу застосовується до всіх місяців. Легенда показує лише знаки, використані у вибраному місяці." },
  "Заменить…": { de: "Ersetzen…", en: "Replace…", uk: "Замінити…" },
  "Сбросить": { de: "Zurücksetzen", en: "Reset", uk: "Скинути" },
  "Данные дней и праздников берутся из рассчитанного календаря": { de: "Tage und Feste stammen aus dem berechneten Kalender", en: "Days and feasts come from the calculated calendar", uk: "Дані днів і свят беруться з розрахованого календаря" },
  "Фигура": { de: "Form", en: "Shape", uk: "Фігура" },
  "Тип заливки": { de: "Füllart", en: "Fill type", uk: "Тип заливки" },
  "Сплошной цвет": { de: "Volltonfarbe", en: "Solid colour", uk: "Суцільний колір" },
  "Линейный градиент": { de: "Linearer Verlauf", en: "Linear gradient", uk: "Лінійний градієнт" },
  "Заливка": { de: "Füllung", en: "Fill", uk: "Заливка" },
  "Начало": { de: "Anfang", en: "Start", uk: "Початок" },
  "Блик": { de: "Glanzlicht", en: "Highlight", uk: "Відблиск" },
  "Конец": { de: "Ende", en: "End", uk: "Кінець" },
  "Направление": { de: "Richtung", en: "Direction", uk: "Напрямок" },
  "Слева направо": { de: "Von links nach rechts", en: "Left to right", uk: "Зліва направо" },
  "Сверху вниз": { de: "Von oben nach unten", en: "Top to bottom", uk: "Зверху вниз" },
  "Золотой металлический градиент": { de: "Goldener Metallverlauf", en: "Gold metallic gradient", uk: "Золотий металевий градієнт" },
  "Обводка": { de: "Kontur", en: "Stroke", uk: "Обведення" },
  "Толщина, мм": { de: "Stärke, mm", en: "Width, mm", uk: "Товщина, мм" },
  "Легенда": { de: "Legende", en: "Legend", uk: "Легенда" },
  "Легенда располагает только применённые в этом месяце знаки в одну строку и собирает их у правого края. Свободное место остаётся слева; саму легенду можно двигать мышью.": { de: "Die Legende zeigt nur die in diesem Monat verwendeten Zeichen in einer Zeile am rechten Rand. Der freie Platz bleibt links; die Legende kann mit der Maus verschoben werden.", en: "The legend places only the icons used in this month in one row at the right edge. Free space remains on the left, and the legend can be moved with the mouse.", uk: "Легенда розміщує лише використані цього місяця знаки в один ряд біля правого краю. Вільне місце залишається ліворуч; саму легенду можна пересувати мишею." },
  "Переполнение": { de: "Überlauf", en: "Overflow", uk: "Переповнення" },
  "нет": { de: "keine", en: "none", uk: "немає" },
  "ошибка": { de: "Fehler", en: "error", uk: "помилка" },
  "требует внимания": { de: "prüfen", en: "needs attention", uk: "потребує уваги" },
  "Добавить шрифт": { de: "Schrift hinzufügen", en: "Add font", uk: "Додати шрифт" },
  "Удалить шрифт": { de: "Schrift entfernen", en: "Remove font", uk: "Видалити шрифт" },
  "Название страницы": { de: "Seitenname", en: "Page name", uk: "Назва сторінки" },
  "Ориентация страницы": { de: "Seitenausrichtung", en: "Page orientation", uk: "Орієнтація сторінки" },
  "Вылеты, мм": { de: "Beschnitt, mm", en: "Bleed, mm", uk: "Вильоти, мм" },
  "Верх": { de: "Oben", en: "Top", uk: "Верх" },
  "Право": { de: "Rechts", en: "Right", uk: "Праворуч" },
  "Низ": { de: "Unten", en: "Bottom", uk: "Низ" },
  "Лево": { de: "Links", en: "Left", uk: "Ліворуч" },
  "Безопасная область, мм": { de: "Sicherheitsbereich, mm", en: "Safe area, mm", uk: "Безпечна область, мм" },
  "Метки реза": { de: "Schnittmarken", en: "Crop marks", uk: "Мітки різання" },
  "Добавлять в печатный PDF": { de: "Zum Druck-PDF hinzufügen", en: "Include in print PDF", uk: "Додавати до PDF для друку" },
  "Длина": { de: "Länge", en: "Length", uk: "Довжина" },
  "Отступ": { de: "Abstand", en: "Offset", uk: "Відступ" },
  "Переплёт и типография": { de: "Bindung und Druckerei", en: "Binding and print shop", uk: "Палітурка й друкарня" },
  "Сторона переплёта": { de: "Bindeseite", en: "Binding edge", uk: "Сторона палітурки" },
  "Без переплёта": { de: "Keine Bindung", en: "No binding", uk: "Без палітурки" },
  "Сверху / пружина": { de: "Oben / Spiralbindung", en: "Top / wire binding", uk: "Зверху / пружина" },
  "Защитная зона, мм": { de: "Schutzzone, mm", en: "Binding safe area, mm", uk: "Захисна зона, мм" },
  "Стандарт PDF": { de: "PDF-Standard", en: "PDF standard", uk: "Стандарт PDF" },
  "Заменить ICC-профиль…": { de: "ICC-Profil ersetzen…", en: "Replace ICC profile…", uk: "Замінити ICC-профіль…" },
  "Загрузить ICC-профиль типографии…": { de: "ICC-Profil der Druckerei laden…", en: "Load print shop ICC profile…", uk: "Завантажити ICC-профіль друкарні…" },
  "Для PDF/X-4 нужен ICC/ICM-файл типографии.": { de: "Für PDF/X-4 ist eine ICC/ICM-Datei der Druckerei erforderlich.", en: "PDF/X-4 requires an ICC/ICM file from the print shop.", uk: "Для PDF/X-4 потрібен ICC/ICM-файл друкарні." },
  "Линейки, bleed и safe area являются только интерфейсом редактора.": { de: "Lineale, Beschnitt und Sicherheitsbereich gehören nur zur Editoroberfläche.", en: "Rulers, bleed and safe area are editor aids only.", uk: "Лінійки, bleed і safe area є лише інтерфейсом редактора." },
  "Слои текущей страницы": { de: "Ebenen der aktuellen Seite", en: "Current page layers", uk: "Шари поточної сторінки" },
  "Добавить событие": { de: "Termin hinzufügen", en: "Add event", uk: "Додати подію" },
  "Ежегодных и разовых событий пока нет.": { de: "Noch keine jährlichen oder einmaligen Termine.", en: "There are no annual or one-time events yet.", uk: "Щорічних і разових подій поки немає." },
  "Без названия": { de: "Ohne Titel", en: "Untitled", uk: "Без назви" },
  "Удалить событие": { de: "Termin löschen", en: "Delete event", uk: "Видалити подію" },
  "Название": { de: "Name", en: "Name", uk: "Назва" },
  "Кратко": { de: "Kurz", en: "Short", uk: "Коротко" },
  "Очень кратко": { de: "Sehr kurz", en: "Very short", uk: "Дуже коротко" },
  "Повтор": { de: "Wiederholung", en: "Repeat", uk: "Повтор" },
  "Каждый год": { de: "Jedes Jahr", en: "Every year", uk: "Щороку" },
  "Один раз": { de: "Einmal", en: "Once", uk: "Один раз" },
  "День": { de: "Tag", en: "Day", uk: "День" },
  "Дата": { de: "Datum", en: "Date", uk: "Дата" },
  "Приоритет": { de: "Priorität", en: "Priority", uk: "Пріоритет" },
  "Критических ошибок нет": { de: "Keine kritischen Fehler", en: "No critical errors", uk: "Критичних помилок немає" },
  "предупреждений": { de: "Warnungen", en: "warnings", uk: "попереджень" },
  "Документ готов к печатному экспорту.": { de: "Das Dokument ist bereit für den Druckexport.", en: "The document is ready for print export.", uk: "Документ готовий до експорту для друку." },
  "Шаблон календаря": { de: "Kalendervorlage", en: "Calendar template", uk: "Шаблон календаря" },
  "Создать обложку и 12 месяцев": { de: "Umschlag und 12 Monate erstellen", en: "Create cover and 12 months", uk: "Створити обкладинку та 12 місяців" },
  "Сделать этот месяц мастер-страницей…": { de: "Diesen Monat als Musterseite verwenden…", en: "Use this month as master page…", uk: "Зробити цей місяць майстер-сторінкою…" },
  "Мои шаблоны": { de: "Meine Vorlagen", en: "My templates", uk: "Мої шаблони" },
  "Сохранить текущий дизайн…": { de: "Aktuelles Design speichern…", en: "Save current design…", uk: "Зберегти поточний дизайн…" },
  "Сохранённых шаблонов пока нет.": { de: "Noch keine gespeicherten Vorlagen.", en: "There are no saved templates yet.", uk: "Збережених шаблонів поки немає." },
  "Удалить шаблон": { de: "Vorlage löschen", en: "Delete template", uk: "Видалити шаблон" },
  "Шаблоны календарной сетки": { de: "Kalenderraster-Vorlagen", en: "Calendar grid templates", uk: "Шаблони календарної сітки" },
  "Макеты календарной сетки": { de: "Kalenderraster-Layouts", en: "Calendar grid layouts", uk: "Макети календарної сітки" },
  "Выберите макет для текущей сетки или сразу для всех двенадцати месяцев. После применения все параметры можно менять в «Свойствах».": { de: "Wählen Sie ein Layout für das aktuelle Raster oder für alle zwölf Monate. Danach können alle Parameter unter „Eigenschaften“ geändert werden.", en: "Choose a layout for the current grid or all twelve months. You can then edit every setting in Properties.", uk: "Виберіть макет для поточної сітки або відразу для всіх дванадцяти місяців. Після застосування всі параметри можна змінювати у «Властивостях»." },
  "12 месяцев": { de: "12 Monate", en: "12 months", uk: "12 місяців" },
  "Обновить": { de: "Aktualisieren", en: "Update", uk: "Оновити" },
  "Управление владельца": { de: "Verwaltung durch den Inhaber", en: "Owner management", uk: "Керування власника" },
  "Только вы можете изменять набор, который видят все пользователи.": { de: "Nur Sie können die Auswahl ändern, die alle Benutzer sehen.", en: "Only you can change the set visible to every user.", uk: "Лише ви можете змінювати набір, який бачать усі користувачі." },
  "Сохранить выбранную сетку для всех…": { de: "Gewähltes Raster für alle speichern…", en: "Save selected grid for everyone…", uk: "Зберегти вибрану сітку для всіх…" },
  "Управление общими макетами…": { de: "Gemeinsame Layouts verwalten…", en: "Manage shared layouts…", uk: "Керування спільними макетами…" },
  "Название общего макета календарной сетки": { de: "Name des gemeinsamen Kalenderraster-Layouts", en: "Shared calendar-grid layout name", uk: "Назва спільного макета календарної сітки" },
  "Новый макет": { de: "Neues Layout", en: "New layout", uk: "Новий макет" },
  "Кратко опишите отличие макета": { de: "Beschreiben Sie kurz den Unterschied", en: "Briefly describe what makes this layout different", uk: "Коротко опишіть відмінність макета" },
  "Авторский макет календарной сетки": { de: "Eigenes Kalenderraster-Layout", en: "Custom calendar-grid layout", uk: "Авторський макет календарної сітки" },
  "Применить к выбранной сетке": { de: "Auf das gewählte Raster anwenden", en: "Apply to selected grid", uk: "Застосувати до вибраної сітки" },
  "Заменить макет оформлением выбранной сетки": { de: "Layout durch die Gestaltung des gewählten Rasters ersetzen", en: "Replace layout with the selected grid styling", uk: "Замінити макет оформленням вибраної сітки" },
  "Удалить общий макет": { de: "Gemeinsames Layout löschen", en: "Delete shared layout", uk: "Видалити спільний макет" },
  "Личные макеты сетки": { de: "Persönliche Raster-Layouts", en: "Personal grid layouts", uk: "Особисті макети сітки" },
  "Сервер общих макетов временно недоступен. Пять встроенных макетов продолжают работать.": { de: "Der Server für gemeinsame Layouts ist vorübergehend nicht erreichbar. Die fünf integrierten Layouts funktionieren weiterhin.", en: "The shared-layout server is temporarily unavailable. The five built-in layouts remain available.", uk: "Сервер спільних макетів тимчасово недоступний. П’ять вбудованих макетів продовжують працювати." },
  "Издательская классика": { de: "Verlagsklassik", en: "Editorial classic", uk: "Видавнича класика" },
  "Полные названия дней, крупные даты и лёгкие пунктирные разделители.": { de: "Volle Wochentagsnamen, große Datumszahlen und feine gestrichelte Trennlinien.", en: "Full weekday names, large dates and light dashed dividers.", uk: "Повні назви днів, великі дати й легкі пунктирні роздільники." },
  "Монастырская книга": { de: "Klosterbuch", en: "Monastic book", uk: "Монастирська книга" },
  "Строгая рамочная сетка, церковный шрифт и дата по старому стилю.": { de: "Strenges gerahmtes Raster, kirchliche Schrift und Datum nach altem Stil.", en: "A strict boxed grid, ecclesiastical type and the Old Style date.", uk: "Строга рамкова сітка, церковний шрифт і дата за старим стилем." },
  "Современная светлая": { de: "Modern und hell", en: "Clean modern", uk: "Сучасна світла" },
  "Короткие дни недели, свободная сетка и нейтральный шрифт без засечек.": { de: "Kurze Wochentage, offenes Raster und neutrale serifenlose Schrift.", en: "Short weekdays, an open grid and neutral sans-serif type.", uk: "Короткі назви днів, вільна сітка й нейтральний шрифт без зарубок." },
  "Торжественная золотая": { de: "Festliches Gold", en: "Festal gold", uk: "Урочиста золота" },
  "Золотые заголовки и числа с тенью для праздничного оформления.": { de: "Goldene Überschriften und Zahlen mit Schatten für festliche Gestaltung.", en: "Gold headings and numbers with a shadow for festal designs.", uk: "Золоті заголовки й числа з тінню для святкового оформлення." },
  "Компактная подробная": { de: "Kompakt und ausführlich", en: "Compact detailed", uk: "Компактна докладна" },
  "Больше памятей в ячейке, сокращённые дни и плотная книжная верстка.": { de: "Mehr Gedenktage pro Zelle, kurze Wochentage und dichter Buchsatz.", en: "More commemorations per cell, short weekdays and dense book typography.", uk: "Більше пам’ятей у комірці, скорочені дні й щільна книжкова верстка." },
  "Сохранить выбранную сетку…": { de: "Gewähltes Raster speichern…", en: "Save selected grid…", uk: "Зберегти вибрану сітку…" },
  "Сохранённых сеток пока нет.": { de: "Noch keine gespeicherten Raster.", en: "There are no saved grids yet.", uk: "Збережених сіток поки немає." },
  "Применить ко всем месяцам": { de: "Auf alle Monate anwenden", en: "Apply to all months", uk: "Застосувати до всіх місяців" },
  "Удалить шаблон сетки": { de: "Rastervorlage löschen", en: "Delete grid template", uk: "Видалити шаблон сітки" },
  "без ошибок": { de: "keine Fehler", en: "no errors", uk: "без помилок" },
  "Автовосстановление": { de: "Automatische Wiederherstellung", en: "Auto recovery", uk: "Автовідновлення" },
  "Горячие клавиши": { de: "Tastenkürzel", en: "Keyboard shortcuts", uk: "Гарячі клавіші" },
  "Начало работы": { de: "Erste Schritte", en: "Getting started", uk: "Початок роботи" },
  "На стартовой странице нажмите «Создать календарь». При первом создании подтвердите e-mail по ссылке из письма.": { de: "Klicken Sie auf der Startseite auf „Kalender erstellen“. Bestätigen Sie beim ersten Mal Ihre E-Mail über den Link in der Nachricht.", en: "On the start page, click “Create calendar”. The first time, verify your email using the link in the message.", uk: "На стартовій сторінці натисніть «Створити календар». Під час першого створення підтвердьте e-mail за посиланням із листа." },
  "В меню «Макет» создайте обложку и 12 месяцев либо добавляйте страницы по одной.": { de: "Erstellen Sie im Menü „Layout“ den Umschlag und 12 Monate oder fügen Sie Seiten einzeln hinzu.", en: "Use the Layout menu to create a cover and 12 months, or add pages one by one.", uk: "У меню «Макет» створіть обкладинку та 12 місяців або додавайте сторінки по одній." },
  "Выберите страницу, затем объект на листе или в панели «Слои».": { de: "Wählen Sie eine Seite und dann ein Objekt auf der Seite oder im Bedienfeld „Ebenen“.", en: "Select a page, then select an object on the sheet or in the Layers panel.", uk: "Виберіть сторінку, потім об’єкт на аркуші або в панелі «Шари»." },
  "Настройте геометрию, оформление и содержимое справа в панели «Свойства».": { de: "Stellen Sie Geometrie, Gestaltung und Inhalt rechts im Bedienfeld „Eigenschaften“ ein.", en: "Adjust geometry, appearance and content in the Properties panel on the right.", uk: "Налаштуйте геометрію, оформлення та вміст праворуч у панелі «Властивості»." },
  "Рабочее пространство": { de: "Arbeitsbereich", en: "Workspace", uk: "Робочий простір" },
  "Верхнее меню": { de: "Oberes Menü", en: "Top menu", uk: "Верхнє меню" },
  "— создание, открытие, сохранение, совместная работа, экспорт, команды макета и помощь. Полоса под ним показывает координаты и размер выбранного объекта.": { de: "– Erstellen, Öffnen, Speichern, Zusammenarbeit, Export, Layoutbefehle und Hilfe. Die Leiste darunter zeigt Koordinaten und Größe des gewählten Objekts.", en: "—create, open, save, collaborate, export, use layout commands and access help. The bar below shows the selected object’s coordinates and size.", uk: "— створення, відкриття, збереження, спільна робота, експорт, команди макета та допомога. Смуга під ним показує координати й розмір вибраного об’єкта." },
  "Левая панель": { de: "Linke Werkzeugleiste", en: "Left toolbar", uk: "Ліва панель" },
  "— выбор, текст, изображения, фигуры, сетка, рука, масштаб и шаблоны.": { de: "– Auswahl, Text, Bilder, Formen, Raster, Hand, Zoom und Vorlagen.", en: "—selection, text, images, shapes, grid, hand, zoom and templates.", uk: "— вибір, текст, зображення, фігури, сітка, рука, масштаб і шаблони." },
  "Центр": { de: "Mitte", en: "Centre", uk: "Центр" },
  "— печатная страница с линейками и направляющими.": { de: "– die Druckseite mit Linealen und Hilfslinien.", en: "—the print page with rulers and guides.", uk: "— друкована сторінка з лінійками й напрямними." },
  "Правая панель": { de: "Rechtes Bedienfeld", en: "Right panel", uk: "Права панель" },
  "— свойства, библиотека золотых и SVG‑элементов, слои, страницы с превью, монастырские события и предпечатная проверка. Её левую границу можно тянуть мышью.": { de: "– Eigenschaften, Bibliothek mit Gold- und SVG-Elementen, Ebenen, Seitenvorschau, Klostertermine und Druckprüfung. Der linke Rand kann mit der Maus gezogen werden.", en: "—properties, gold and SVG library, layers, page previews, monastery events and preflight. Drag its left edge to resize it.", uk: "— властивості, бібліотека золотих і SVG-елементів, шари, сторінки з попереднім переглядом, монастирські події та переддрукарська перевірка. Її ліву межу можна тягнути мишею." },
  "Нижняя строка": { de: "Untere Statusleiste", en: "Bottom status bar", uk: "Нижній рядок" },
  "— результаты проверки, состояние сохранения, совместной работы и подготовки PDF.": { de: "– Prüfergebnisse sowie Status von Speicherung, Zusammenarbeit und PDF-Erstellung.", en: "—preflight results and the status of saving, collaboration and PDF preparation.", uk: "— результати перевірки, стан збереження, спільної роботи та підготовки PDF." },
  "Где хранятся календари?": { de: "Wo werden Kalender gespeichert?", en: "Where are calendars stored?", uk: "Де зберігаються календарі?" },
  "впервые предложит выбрать файл, а затем обновляет тот же файл.": { de: "fragt beim ersten Mal nach einer Datei und aktualisiert sie danach.", en: "asks you to choose a file the first time, then updates the same file.", uk: "уперше запропонує вибрати файл, а потім оновлює той самий файл." },
  "создаёт новый файл проекта. Это прямое сохранение поддерживается в Chrome и Edge; в браузерах без доступа к файловой системе редактор создаёт новую загрузку.": { de: "erstellt eine neue Projektdatei. Direktes Speichern wird in Chrome und Edge unterstützt; andere Browser laden bei jedem Speichern eine neue Datei herunter.", en: "creates a new project file. Direct saving is supported in Chrome and Edge; browsers without file-system access create a new download.", uk: "створює новий файл проєкту. Пряме збереження підтримується в Chrome та Edge; у браузерах без доступу до файлової системи редактор створює нове завантаження." },
  "Последняя работа сохраняется на этом компьютере для быстрого продолжения. Отдельный файл": { de: "Die letzte Arbeit wird auf diesem Computer gespeichert, damit Sie schnell fortfahren können. Eine separate", en: "Your latest work is saved on this computer so you can continue quickly. A separate", uk: "Остання робота зберігається на цьому комп’ютері для швидкого продовження. Окремий файл" },
  "остаётся вашей основной копией календаря.": { de: "-Datei bleibt Ihre Hauptkopie des Kalenders.", en: "file remains your primary calendar copy.", uk: "залишається вашою основною копією календаря." },
  "Команда": { de: "Der Befehl", en: "The command", uk: "Команда" },
  "создаёт ссылку, которую можно отправить другому человеку. Если календарь уже редактируют, его можно открыть позже или сделать отдельную копию.": { de: "erstellt einen Link, den Sie an eine andere Person senden können. Wird der Kalender gerade bearbeitet, kann sie später öffnen oder eine eigene Kopie erstellen.", en: "creates a link you can send to another person. If the calendar is being edited, they can open it later or make a separate copy.", uk: "створює посилання, яке можна надіслати іншій людині. Якщо календар уже редагують, його можна відкрити пізніше або зробити окрему копію." },
  "Параметры числа, старого стиля, текста событий, знаков типикона и поста задаются независимо. В «Шаблонах календаря» доступны не менее пяти общих макетов сетки: примените один из них к выбранному месяцу или сразу ко всем месяцам, затем измените параметры в «Свойствах». Только подтверждённый владелец мастерской может сохранить изменённую сетку как общий макет для всех пользователей.": { de: "Tageszahl, Datum nach altem Stil, Ereignistext sowie Typikon- und Fastenzeichen werden unabhängig eingestellt. Unter „Kalendervorlagen“ stehen mindestens fünf gemeinsame Raster-Layouts bereit. Wenden Sie eines auf den gewählten Monat oder alle Monate an und ändern Sie es danach unter „Eigenschaften“. Nur der bestätigte Inhaber kann ein geändertes Raster als gemeinsames Layout für alle speichern.", en: "Day number, Old Style date, event text, Typikon marks and fasting icons are configured independently. Calendar Templates contains at least five shared grid layouts. Apply one to the selected month or all months, then edit it in Properties. Only the verified workshop owner can save an edited grid as a shared layout for everyone.", uk: "Параметри числа, старого стилю, тексту подій, знаків типікону й посту задаються незалежно. У «Шаблонах календаря» доступно щонайменше п’ять спільних макетів сітки. Застосуйте один до вибраного місяця або всіх місяців, а потім змініть у «Властивостях». Лише підтверджений власник майстерні може зберегти змінену сітку як спільний макет для всіх." },
  "Изображения, скругление и маски": { de: "Bilder, Rundungen und Masken", en: "Images, rounded corners and masks", uk: "Зображення, заокруглення та маски" },
  "В режиме «С обрезкой» ползунки «Положение кадра» сдвигают изображение внутри его рамки по горизонтали и вертикали. Кнопка «По центру» возвращает исходное положение.": { de: "Im Modus „Beschneiden“ verschieben die Regler „Bildausschnitt“ das Bild horizontal und vertikal im Rahmen. „Zentrieren“ stellt die Ausgangsposition wieder her.", en: "In Crop mode, the Frame position sliders move the image horizontally and vertically inside its frame. Centre resets the position.", uk: "У режимі «З обрізанням» повзунки «Положення кадру» зсувають зображення всередині рамки горизонтально й вертикально. Кнопка «По центру» повертає початкове положення." },
  "Параметр «Скругление» действует на любой объект. Маска принадлежит слою и настраивается во вкладке «Слои»: загрузите чёрно-белое изображение либо примените уже размещённый PNG/SVG‑элемент. Белое показывает слой, чёрное скрывает, серое даёт полупрозрачность. Исходный объект при этом не меняется.": { de: "„Eckenradius“ gilt für jedes Objekt. Die Maske gehört zur Ebene und wird unter „Ebenen“ eingestellt: Laden Sie ein Schwarzweißbild oder verwenden Sie ein platziertes PNG-/SVG-Element. Weiß zeigt, Schwarz verbirgt und Grau macht halbtransparent. Das Original bleibt unverändert.", en: "Corner radius applies to any object. A mask belongs to a layer and is configured in Layers: upload a black-and-white image or use a placed PNG/SVG element. White reveals, black hides and grey adds transparency. The original is unchanged.", uk: "Параметр «Заокруглення» діє на будь-який об’єкт. Маска належить шару й налаштовується у вкладці «Шари»: завантажте чорно-біле зображення або застосуйте вже розміщений PNG/SVG-елемент. Біле показує шар, чорне приховує, сіре дає напівпрозорість. Початковий об’єкт не змінюється." },
  "Печать": { de: "Druck", en: "Printing", uk: "Друк" },
  "Перед экспортом откройте панель «Проверка», устраните ошибки и проверьте предупреждения. Команда «Экспортировать печатный PDF…» подготовит многостраничный файл с реальными размерами, вылетами и метками реза, после чего покажет кнопку скачивания.": { de: "Öffnen Sie vor dem Export „Prüfung“, beheben Sie Fehler und prüfen Sie Warnungen. „Druck-PDF exportieren…“ erstellt eine mehrseitige Datei mit echten Maßen, Beschnitt und Schnittmarken und zeigt anschließend den Download an.", en: "Before export, open Preflight, fix errors and review warnings. Export Print PDF creates a multipage file with real dimensions, bleed and crop marks, then shows the download button.", uk: "Перед експортом відкрийте панель «Перевірка», виправте помилки та перегляньте попередження. Команда «Експортувати PDF для друку…» підготує багатосторінковий файл із реальними розмірами, вильотами й мітками різання, після чого покаже кнопку завантаження." },
  "Редактирование": { de: "Bearbeitung", en: "Editing", uk: "Редагування" },
  "Открыть проект": { de: "Projekt öffnen", en: "Open project", uk: "Відкрити проєкт" },
  "Экспортировать PDF": { de: "PDF exportieren", en: "Export PDF", uk: "Експортувати PDF" },
  "Отменить / повторить": { de: "Rückgängig / wiederholen", en: "Undo / redo", uk: "Скасувати / повторити" },
  "Дублировать объект": { de: "Objekt duplizieren", en: "Duplicate object", uk: "Дублювати об’єкт" },
  "Удалить выбранное": { de: "Auswahl löschen", en: "Delete selection", uk: "Видалити вибране" },
  "или": { de: "oder", en: "or", uk: "або" },
  "Переместить объект на 1 мм": { de: "Objekt um 1 mm verschieben", en: "Move object by 1 mm", uk: "Перемістити об’єкт на 1 мм" },
  "Переместить объект на 10 мм": { de: "Objekt um 10 mm verschieben", en: "Move object by 10 mm", uk: "Перемістити об’єкт на 10 мм" },
  "стрелка": { de: "Pfeiltaste", en: "arrow key", uk: "стрілка" },
  "Инструменты и вид": { de: "Werkzeuge und Ansicht", en: "Tools and view", uk: "Інструменти та вигляд" },
  "Выделение / текст / изображение": { de: "Auswahl / Text / Bild", en: "Selection / text / image", uk: "Виділення / текст / зображення" },
  "Прямоугольник / эллипс / линия": { de: "Rechteck / Ellipse / Linie", en: "Rectangle / ellipse / line", uk: "Прямокутник / еліпс / лінія" },
  "Рука / масштаб": { de: "Hand / Zoom", en: "Hand / zoom", uk: "Рука / масштаб" },
  "Увеличить / уменьшить масштаб": { de: "Vergrößern / verkleinern", en: "Zoom in / out", uk: "Збільшити / зменшити масштаб" },
  "Скрыть или показать панели": { de: "Bedienfelder aus-/einblenden", en: "Hide or show panels", uk: "Приховати або показати панелі" },
  "Однобуквенные команды не срабатывают во время ввода текста или значений в полях.": { de: "Einzelne Buchstabenbefehle sind beim Eingeben von Text oder Feldwerten deaktiviert.", en: "Single-letter shortcuts are disabled while entering text or values in fields.", uk: "Однолітерні команди не спрацьовують під час введення тексту або значень у полях." },
  "Издательский инструмент для подготовки православных печатных календарей.": { de: "Publikationswerkzeug zur Erstellung orthodoxer Druckkalender.", en: "A publishing tool for preparing Orthodox print calendars.", uk: "Видавничий інструмент для підготовки православних друкованих календарів." },
  "Проект монастыря": { de: "Klosterprojekt", en: "Monastery project", uk: "Проєкт монастиря" },
  "Свято‑Георгиевский мужской монастырь Берлинской епархии в Гётчендорфе.": { de: "Orthodoxes Männerkloster St. Georg der Berliner Diözese in Götschendorf.", en: "St George Orthodox Monastery of the Berlin Diocese in Götschendorf.", uk: "Свято-Георгіївський чоловічий монастир Берлінської єпархії в Гетчендорфі." },
  "Разработка": { de: "Entwicklung", en: "Development", uk: "Розробка" },
  "Рабочая область документа": { de: "Dokumentarbeitsbereich", en: "Document workspace", uk: "Робоча область документа" },
  "Горизонтальная линейка в миллиметрах": { de: "Horizontales Lineal in Millimetern", en: "Horizontal ruler in millimetres", uk: "Горизонтальна лінійка в міліметрах" },
  "Вертикальная линейка в миллиметрах": { de: "Vertikales Lineal in Millimetern", en: "Vertical ruler in millimetres", uk: "Вертикальна лінійка в міліметрах" },
  "выключены": { de: "aus", en: "off", uk: "вимкнено" },
  "Градиент букв": { de: "Buchstabenverlauf", en: "Letter gradient", uk: "Градієнт літер" },
  "Золотой градиент": { de: "Goldverlauf", en: "Gold gradient", uk: "Золотий градієнт" },
  "Объём букв": { de: "Buchstabenrelief", en: "Letter extrusion", uk: "Об’єм літер" },
  "Цвет объёма": { de: "Relieffarbe", en: "Extrusion colour", uk: "Колір об’єму" },
  "Глубина, мм": { de: "Tiefe, mm", en: "Depth, mm", uk: "Глибина, мм" },
  "Направление, °": { de: "Richtung, °", en: "Direction, °", uk: "Напрямок, °" },
  "Тень": { de: "Schatten", en: "Shadow", uk: "Тінь" },
  "Цвет тени": { de: "Schattenfarbe", en: "Shadow colour", uk: "Колір тіні" },
  "Размытие, мм": { de: "Weichzeichnung, mm", en: "Blur, mm", uk: "Розмиття, мм" },
  "Разработка ATAPIN.DE": { de: "Entwicklung: ATAPIN.DE", en: "Developed by ATAPIN.DE", uk: "Розробка: ATAPIN.DE" },
  "Источник: мм": { de: "Quelle: MM", en: "Source: MM", uk: "Джерело: ММ" },
  "Элементы": { de: "Elemente", en: "Elements", uk: "Елементи" },
  "События": { de: "Termine", en: "Events", uk: "Події" },
  "Строгий устав": { de: "Strenge Klosterregel", en: "Strict monastic rule", uk: "Суворий устав" },
  "Приходская практика": { de: "Gemeindepraxis", en: "Parish practice", uk: "Парафіяльна практика" },
  "Монастырская мера с сухоядением и днями полного воздержания. Версия правил 2026.09.": { de: "Klosterregel mit Trockenkost und Tagen vollständiger Enthaltung. Regelversion 2026.09.", en: "Monastic rule with dry eating and days of complete abstinence. Rules version 2026.09.", uk: "Монастирська міра із сухоїдінням і днями повного утримання. Версія правил 2026.09." },
  "Смягчённое отображение для мирян без назначения личной меры": { de: "Vereinfachte Darstellung für Laien ohne Festlegung einer persönlichen Regel", en: "A simplified display for laypeople without prescribing a personal rule", uk: "Пом’якшене відображення для мирян без призначення особистої міри" },
  "Шрифты проекта": { de: "Projektschriften", en: "Project fonts", uk: "Шрифти проєкту" },
  "Файл проекта не выбран": { de: "Keine Projektdatei ausgewählt", en: "No project file selected", uk: "Файл проєкту не вибрано" },
  "Рамки": { de: "Rahmen", en: "Frames", uk: "Рамки" },
  "Углы и бордюры": { de: "Ecken und Bordüren", en: "Corners and borders", uk: "Кути й бордюри" },
  "Разделители": { de: "Trennelemente", en: "Dividers", uk: "Розділювачі" },
  "Орнаменты": { de: "Ornamente", en: "Ornaments", uk: "Орнаменти" },
  "Церковные изображения": { de: "Kirchliche Darstellungen", en: "Church images", uk: "Церковні зображення" },
  "Символы": { de: "Symbole", en: "Symbols", uk: "Символи" },
  "Фирменный знак Календарной мастерской": { de: "Markenzeichen der Kalenderwerkstatt", en: "Calendar Workshop brand mark", uk: "Фірмовий знак Календарної майстерні" },
  "Слой 1": { de: "Ebene 1", en: "Layer 1", uk: "Шар 1" },
  "Фото + издательская сетка": { de: "Foto + Editorialraster", en: "Photo + editorial grid", uk: "Фото + видавнича сітка" },
  "Крупное фото, открытая газетная верстка и текст месяца.": { de: "Großes Foto, offenes Editoriallayout und Monatstext.", en: "Large photo, open editorial layout and month text.", uk: "Велике фото, відкрита газетна верстка й текст місяця." },
  "Классическая таблица": { de: "Klassische Tabelle", en: "Classic table", uk: "Класична таблиця" },
  "Больше места календарю, ячейки с полной рамкой.": { de: "Mehr Platz für den Kalender, vollständig umrandete Zellen.", en: "More room for the calendar with fully bordered cells.", uk: "Більше місця календарю, клітинки з повною рамкою." },
  "Акцент на фотографии": { de: "Foto im Mittelpunkt", en: "Photo focus", uk: "Акцент на фотографії" },
  "Половина страницы под фото, компактная сетка без рамок.": { de: "Eine halbe Seite für das Foto, kompaktes Raster ohne Rahmen.", en: "Half a page for the photo, with a compact borderless grid.", uk: "Половина сторінки для фото, компактна сітка без рамок." },
  "Файл → Поделиться для совместной работы…": { de: "Datei → Zur Zusammenarbeit freigeben…", en: "File → Share for collaboration…", uk: "Файл → Поділитися для спільної роботи…" },
  "древнерусский": { de: "altrussisch", en: "Old Russian", uk: "давньоруський" },
  "торжественный": { de: "feierlich", en: "ceremonial", uk: "урочистий" },
  "рукописный": { de: "handschriftlich", en: "handwritten", uk: "рукописний" },
  "орнаментальный": { de: "ornamental", en: "ornamental", uk: "орнаментальний" },
  "декоративный": { de: "dekorativ", en: "decorative", uk: "декоративний" },
  "сверхсжатый": { de: "extrem schmal", en: "extra condensed", uk: "надстислий" },
  "с тенью": { de: "mit Schatten", en: "shadowed", uk: "з тінню" },
  "старославянский": { de: "altslawisch", en: "Old Slavonic", uk: "старослов’янський" },
  "украшенный": { de: "verziert", en: "decorated", uk: "оздоблений" },
  "витой": { de: "geschwungen", en: "flourished", uk: "витий" },
  "художественный": { de: "künstlerisch", en: "artistic", uk: "художній" },
  "сказочный": { de: "märchenhaft", en: "fantasy", uk: "казковий" },
  "со звёздами": { de: "mit Sternen", en: "with stars", uk: "із зірками" },
  "книжный декоративный": { de: "dekorative Antiqua", en: "decorative book face", uk: "книжковий декоративний" },
  "с росчерками": { de: "mit Zierschwüngen", en: "with flourishes", uk: "із розчерками" },
  "контурный": { de: "konturiert", en: "outline", uk: "контурний" },
  "геометрический": { de: "geometrisch", en: "geometric", uk: "геометричний" },
  "трафаретный": { de: "Schablonenschrift", en: "stencil", uk: "трафаретний" },
  "объёмный": { de: "plastisch", en: "dimensional", uk: "об’ємний" },
  "техничный": { de: "technisch", en: "technical", uk: "технічний" },
  "округлый": { de: "abgerundet", en: "rounded", uk: "округлий" },
  "линейный": { de: "linear", en: "inline", uk: "лінійний" },
  "плакатный": { de: "Plakatschrift", en: "poster", uk: "плакатний" },
  "вывесочный": { de: "Ladenschildstil", en: "sign-painting", uk: "вивісковий" },
  "сжатый жирный": { de: "schmal fett", en: "condensed bold", uk: "стислий жирний" },
  "неполная кириллица": { de: "unvollständige Kyrillisch-Unterstützung", en: "partial Cyrillic", uk: "неповна кирилиця" },
  "только латиница": { de: "nur Latein", en: "Latin only", uk: "лише латиниця" },
  "книжный": { de: "Buchschrift", en: "book face", uk: "книжковий" },
  "Пасха и двунадесятые праздники": { de: "Pascha und die zwölf großen Feste", en: "Pascha and the Twelve Great Feasts", uk: "Пасха та дванадесяті свята" },
  "Великие праздники": { de: "Hohe Feste", en: "Major feasts", uk: "Великі свята" },
  "Средние праздники и памяти": { de: "Mittlere Feste und Gedenktage", en: "Medium feasts and commemorations", uk: "Середні свята та пам’яті" },
  "Дни особого поминовения усопших": { de: "Besondere Totengedenktage", en: "Special days of commemoration of the departed", uk: "Дні особливого поминання спочилих" },
  "X, мм": { de: "X, mm", en: "X, mm", uk: "X, мм" },
  "Y, мм": { de: "Y, mm", en: "Y, mm", uk: "Y, мм" },
  "Орнаментальные с надписью": { de: "Ornamental mit Beschriftung", en: "Ornamental with labels", uk: "Орнаментальні з написом" },
  "Круглые светлые знаки с подписью категории.": { de: "Helle runde Zeichen mit Kategorienbeschriftung.", en: "Light round icons labelled by category.", uk: "Круглі світлі знаки з підписом категорії." },
  "постный день без рыбы": { de: "Fasttag ohne Fisch", en: "fast day without fish", uk: "пісний день без риби" },
  "разрешается рыба": { de: "Fisch erlaubt", en: "fish allowed", uk: "дозволяється риба" },
  "варёная пища с маслом (елеем)": { de: "gekochte Speise mit Öl", en: "cooked food with oil", uk: "варена їжа з олією" },
  "варёная пища без масла (елея)": { de: "gekochte Speise ohne Öl", en: "cooked food without oil", uk: "варена їжа без олії" },
  "сухоядение": { de: "Trockenkost", en: "dry eating", uk: "сухоїдіння" },
  "строгий пост": { de: "strenges Fasten", en: "strict fast", uk: "суворий піст" },
  "разрешаются молочные продукты и яйца": { de: "Milchprodukte und Eier erlaubt", en: "dairy products and eggs allowed", uk: "дозволяються молочні продукти та яйця" },
  "день особого поминовения усопших": { de: "besonderer Totengedenktag", en: "special commemoration of the departed", uk: "день особливого поминання спочилих" },
  "В рамку не помещено изображение.": { de: "Das Bild füllt den Rahmen nicht aus.", en: "The image does not fill the frame.", uk: "Зображення не заповнює рамку." },
  "Созданы обложка и 12 месячных страниц": { de: "Umschlag und 12 Monatsseiten erstellt", en: "Cover and 12 monthly pages created", uk: "Створено обкладинку та 12 місячних сторінок" },
  "Открыть другой проект? Несохранённые в файл изменения текущего проекта будут потеряны.": { de: "Ein anderes Projekt öffnen? Nicht in der Datei gespeicherte Änderungen am aktuellen Projekt gehen verloren.", en: "Open another project? Changes to the current project that have not been saved to its file will be lost.", uk: "Відкрити інший проєкт? Не збережені у файл зміни поточного проєкту буде втрачено." },
  "Создать новый проект? Текущий проект будет закрыт. Если он ещё не сохранён в файл, сначала нажмите «Сохранить как…».": { de: "Neues Projekt erstellen? Das aktuelle Projekt wird geschlossen. Falls es noch nicht in einer Datei gespeichert ist, wählen Sie zuerst „Speichern unter…“.", en: "Create a new project? The current project will be closed. If it has not been saved to a file, choose Save As first.", uk: "Створити новий проєкт? Поточний проєкт буде закрито. Якщо його ще не збережено у файл, спочатку натисніть «Зберегти як…»." },
  "Заменить все текущие страницы новой обложкой и 12 месяцами? Изменённые страницы будут удалены. После создания действие можно отменить через Ctrl+Z.": { de: "Alle aktuellen Seiten durch einen neuen Umschlag und 12 Monate ersetzen? Geänderte Seiten werden gelöscht. Danach können Sie den Vorgang mit Ctrl+Z rückgängig machen.", en: "Replace all current pages with a new cover and 12 months? Modified pages will be deleted. You can undo this afterwards with Ctrl+Z.", uk: "Замінити всі поточні сторінки новою обкладинкою та 12 місяцями? Змінені сторінки буде видалено. Після створення дію можна скасувати через Ctrl+Z." },
  "Название шаблона календарной сетки": { de: "Name der Kalenderraster-Vorlage", en: "Calendar grid template name", uk: "Назва шаблону календарної сітки" },
  "Моя календарная сетка": { de: "Mein Kalenderraster", en: "My calendar grid", uk: "Моя календарна сітка" },
  "Применить мастер-страницу?": { de: "Musterseite anwenden?", en: "Apply master page?", uk: "Застосувати майстер-сторінку?" },
  "Название пользовательского шаблона": { de: "Name der eigenen Vorlage", en: "Custom template name", uk: "Назва користувацького шаблону" },
  "дизайн": { de: "Design", en: "design", uk: "дизайн" },
  "Год для копии проекта": { de: "Jahr für die Projektkopie", en: "Year for the project copy", uk: "Рік для копії проєкту" },
  "Название семейства шрифта": { de: "Name der Schriftfamilie", en: "Font family name", uk: "Назва сімейства шрифту" },
  "Календарная мастерская при Свято-Георгиевском монастыре": { de: "Kalenderwerkstatt des orthodoxen St.-Georgs-Klosters", en: "Calendar Workshop at St George Orthodox Monastery", uk: "Календарна майстерня при Свято-Георгіївському монастирі" },
  "Календарная мастерская Свято-Георгиевского монастыря": { de: "Kalenderwerkstatt des orthodoxen St.-Georgs-Klosters", en: "Calendar Workshop of St George Orthodox Monastery", uk: "Календарна майстерня Свято-Георгіївського монастиря" },
  "Сначала подтвердите e-mail": { de: "Bestätigen Sie zuerst Ihre E-Mail", en: "Verify your email first", uk: "Спочатку підтвердьте e-mail" },
  "Сервер совместной работы недоступен": { de: "Der Server für die Zusammenarbeit ist nicht erreichbar", en: "The collaboration server is unavailable", uk: "Сервер спільної роботи недоступний" },
  "Общий календарь не найден": { de: "Gemeinsamer Kalender nicht gefunden", en: "Shared calendar not found", uk: "Спільний календар не знайдено" },
  "Право редактирования утрачено": { de: "Bearbeitungszugriff verloren", en: "Edit access lost", uk: "Право редагування втрачено" },
  "Настройки программы сохранены на сервере и в календаре": { de: "Programmeinstellungen auf dem Server und im Kalender gespeichert", en: "Program settings saved to the server and calendar", uk: "Налаштування програми збережено на сервері та в календарі" },
  "Настройки программы сохранены на этом компьютере и в календаре": { de: "Programmeinstellungen auf diesem Computer und im Kalender gespeichert", en: "Program settings saved on this computer and in the calendar", uk: "Налаштування програми збережено на цьому комп’ютері та в календарі" },
  "Настройки сохранены локально; для сохранения на сервере подтвердите e-mail": { de: "Einstellungen lokal gespeichert; bestätigen Sie Ihre E-Mail, um sie auf dem Server zu speichern", en: "Settings saved locally; verify your email to save them on the server", uk: "Налаштування збережено локально; щоб зберегти їх на сервері, підтвердьте e-mail" },
};

export function domainDefaultLanguage(hostname = typeof location === "undefined" ? "" : location.hostname): "de" | "ru" {
  return hostname.toLowerCase().replace(/\.$/, "") === "kalender.georg-kloster.de" ? "de" : "ru";
}

export function resolveInterfaceLanguage(hostname: string, preference: unknown): InterfaceLanguage {
  return isInterfaceLanguage(preference) ? preference : domainDefaultLanguage(hostname);
}

function storedLanguage(): InterfaceLanguage {
  return resolveBrowserLanguage(
    typeof location === 'undefined' ? '/' : location.pathname,
    typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language],
    typeof location === 'undefined' ? '' : location.hostname,
  );
}

export function resolveBrowserLanguage(path: string, _languages: readonly string[], hostname = ''): InterfaceLanguage {
  const explicit = path.split('/')[1]?.toLowerCase();
  if (isInterfaceLanguage(explicit)) return explicit;
  return domainDefaultLanguage(hostname);
}

export const interfaceLanguage = ref<InterfaceLanguage>(storedLanguage());

export function isInterfaceLanguage(value: unknown): value is InterfaceLanguage {
  return value === "ru" || value === "de" || value === "en" || value === "uk";
}

export function setInterfaceLanguage(language: InterfaceLanguage): void {
  interfaceLanguage.value = language;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(INTERFACE_LANGUAGE_STORAGE_KEY, language);
  } catch { /* Keep manual switching usable without persistent storage. */ }
  if (typeof document !== "undefined") document.documentElement.lang = language;
}

export function translateInterfaceText(source: string, language = interfaceLanguage.value): string {
  if (language === "ru") return source;
  const exact = TRANSLATIONS[source]?.[language];
  if (exact) return exact;
  const orientation = /^(.*?) · (Книжная|Альбомная)$/.exec(source);
  if (orientation) {
    const translated = translateInterfaceText(orientation[2]!, language);
    return `${orientation[1]} · ${translated}`;
  }
  const millimetres = /^(\d+(?:[.,]\d+)?) мм$/.exec(source);
  if (millimetres) return `${millimetres[1]} mm`;
  const pageCount = /^Страница (\d+) из (\d+)$/.exec(source);
  if (pageCount) {
    if (language === "de") return `Seite ${pageCount[1]} von ${pageCount[2]}`;
    if (language === "en") return `Page ${pageCount[1]} of ${pageCount[2]}`;
    return `Сторінка ${pageCount[1]} з ${pageCount[2]}`;
  }
  const loadedRecords = /^Загружено (\d+) календарных записей$/.exec(source);
  if (loadedRecords) {
    if (language === "de") return `${loadedRecords[1]} Kalendereinträge geladen`;
    if (language === "en") return `${loadedRecords[1]} calendar records loaded`;
    return `Завантажено ${loadedRecords[1]} календарних записів`;
  }
  const preflight = /^Проверка: (.*)$/.exec(source);
  if (preflight) return `${translateInterfaceText("Проверка", language)}: ${translateInterfaceText(preflight[1]!, language)}`;
  const recovery = /^Автовосстановление: (.*)$/.exec(source);
  if (recovery) return `${translateInterfaceText("Автовосстановление", language)}: ${recovery[1]}`;
  const calendarStatus = /^(\d+) размещений событий · Пасха (.*)$/.exec(source);
  if (calendarStatus) {
    if (language === "de") return `${calendarStatus[1]} Ereignisplatzierungen · Pascha ${calendarStatus[2]}`;
    if (language === "en") return `${calendarStatus[1]} event placements · Pascha ${calendarStatus[2]}`;
    return `${calendarStatus[1]} розміщень подій · Пасха ${calendarStatus[2]}`;
  }
  const warningCount = /^(\d+) предупреждений$/.exec(source);
  if (warningCount) {
    if (language === "de") return `${warningCount[1]} Warnungen`;
    if (language === "en") return `${warningCount[1]} warnings`;
    return `${warningCount[1]} попереджень`;
  }
  const librarySummary = /^(\d+) из (\d+) · щелчок вставляет на новый верхний слой$/.exec(source);
  if (librarySummary) {
    if (language === "de") return `${librarySummary[1]} von ${librarySummary[2]} · Klick fügt auf einer neuen obersten Ebene ein`;
    if (language === "en") return `${librarySummary[1]} of ${librarySummary[2]} · click to insert on a new top layer`;
    return `${librarySummary[1]} з ${librarySummary[2]} · клацання вставляє на новий верхній шар`;
  }
  const fontDescription = /^(.*?) — (.+)$/.exec(source);
  if (fontDescription && TRANSLATIONS[fontDescription[2]!]) {
    return `${fontDescription[1]} — ${translateInterfaceText(fontDescription[2]!, language)}`;
  }
  const cropPosition = /^(По горизонтали|По вертикали): (-?\d+)%$/.exec(source);
  if (cropPosition) return `${translateInterfaceText(cropPosition[1]!, language)}: ${cropPosition[2]}%`;
  const calculatedCalendar = /^Данные дней и праздников берутся из рассчитанного календаря (\d{4}) года\.$/.exec(source);
  if (calculatedCalendar) {
    if (language === "de") return `Tage und Feste stammen aus dem berechneten Kalender für ${calculatedCalendar[1]}.`;
    if (language === "en") return `Days and feasts come from the calculated ${calculatedCalendar[1]} calendar.`;
    return `Дані днів і свят беруться з розрахованого календаря на ${calculatedCalendar[1]} рік.`;
  }
  const overflow = /^Переполнение: (.*)$/.exec(source);
  if (overflow) return `${translateInterfaceText("Переполнение", language)}: ${translateInterfaceText(overflow[1]!, language)}`;
  const shortenedFeast = /^На (\d+) дне название обязательного праздника сокращено многоточием\.$/.exec(source);
  if (shortenedFeast) {
    if (language === "de") return `An ${shortenedFeast[1]} Tag wurde der Name eines obligatorischen Festes mit Auslassungspunkten gekürzt.`;
    if (language === "en") return `On ${shortenedFeast[1]} day, a required feast name was shortened with an ellipsis.`;
    return `На ${shortenedFeast[1]} дні назву обов’язкового свята скорочено багатокрапкою.`;
  }
  const namedSet = /^набор: (.*)$/.exec(source);
  if (namedSet) {
    const prefix = language === "de" ? "Satz" : language === "en" ? "set" : "набір";
    return `${prefix}: ${translateInterfaceText(namedSet[1]!, language)}`;
  }
  const deleteGridTemplate = /^Удалить шаблон сетки «(.*)»\?$/.exec(source);
  if (deleteGridTemplate) {
    if (language === "de") return `Rastervorlage „${deleteGridTemplate[1]}“ löschen?`;
    if (language === "en") return `Delete grid template “${deleteGridTemplate[1]}”?`;
    return `Видалити шаблон сітки «${deleteGridTemplate[1]}»?`;
  }
  const overwriteGlobalGridTemplate = /^Заменить общий макет «(.*)» оформлением выбранной сетки\? Изменение увидят все пользователи\.$/.exec(source);
  if (overwriteGlobalGridTemplate) {
    if (language === "de") return `Gemeinsames Layout „${overwriteGlobalGridTemplate[1]}“ durch die Gestaltung des gewählten Rasters ersetzen? Alle Benutzer sehen diese Änderung.`;
    if (language === "en") return `Replace shared layout “${overwriteGlobalGridTemplate[1]}” with the selected grid styling? Every user will see this change.`;
    return `Замінити спільний макет «${overwriteGlobalGridTemplate[1]}» оформленням вибраної сітки? Зміну побачать усі користувачі.`;
  }
  const deleteGlobalGridTemplate = /^Удалить общий макет «(.*)»\? Он исчезнет у всех пользователей\.$/.exec(source);
  if (deleteGlobalGridTemplate) {
    if (language === "de") return `Gemeinsames Layout „${deleteGlobalGridTemplate[1]}“ löschen? Es verschwindet für alle Benutzer.`;
    if (language === "en") return `Delete shared layout “${deleteGlobalGridTemplate[1]}”? It will disappear for every user.`;
    return `Видалити спільний макет «${deleteGlobalGridTemplate[1]}»? Він зникне для всіх користувачів.`;
  }
  const deleteTemplate = /^Удалить шаблон «(.*)»\?$/.exec(source);
  if (deleteTemplate) {
    if (language === "de") return `Vorlage „${deleteTemplate[1]}“ löschen?`;
    if (language === "en") return `Delete template “${deleteTemplate[1]}”?`;
    return `Видалити шаблон «${deleteTemplate[1]}»?`;
  }
  const applyTemplate = /^Применить шаблон «(.*)» ко всему документу\? Текущие страницы будут заменены; действие можно отменить\.$/.exec(source);
  if (applyTemplate) {
    if (language === "de") return `Vorlage „${applyTemplate[1]}“ auf das ganze Dokument anwenden? Die aktuellen Seiten werden ersetzt; der Vorgang kann rückgängig gemacht werden.`;
    if (language === "en") return `Apply template “${applyTemplate[1]}” to the entire document? Current pages will be replaced; you can undo this action.`;
    return `Застосувати шаблон «${applyTemplate[1]}» до всього документа? Поточні сторінки буде замінено; дію можна скасувати.`;
  }
  const restoreBackup = /^Восстановить резервную копию «(.*)» от (.*)\?$/.exec(source);
  if (restoreBackup) {
    if (language === "de") return `Sicherung „${restoreBackup[1]}“ vom ${restoreBackup[2]} wiederherstellen?`;
    if (language === "en") return `Restore backup “${restoreBackup[1]}” from ${restoreBackup[2]}?`;
    return `Відновити резервну копію «${restoreBackup[1]}» від ${restoreBackup[2]}?`;
  }
  const masterSummary = /^Мастер «(.*)» будет применён к (\d+) страницам\. Названия месяцев и содержимое текстовых рамок останутся своими\. (\d+) назначенных изображений будут сохранены, а пустые фоторамки останутся пустыми\. Геометрия, сетка, шрифты и декор остальных месяцев будут заменены; действие можно отменить\.\n\nПрименить мастер-страницу\?$/.exec(source);
  if (masterSummary) {
    if (language === "de") return `Die Musterseite „${masterSummary[1]}“ wird auf ${masterSummary[2]} Seiten angewendet. Monatsnamen und Inhalte der Textrahmen bleiben erhalten. ${masterSummary[3]} zugewiesene Bilder bleiben erhalten und leere Fotorahmen bleiben leer. Geometrie, Raster, Schriften und Dekor der übrigen Monate werden ersetzt; der Vorgang kann rückgängig gemacht werden.\n\nMusterseite anwenden?`;
    if (language === "en") return `Master page “${masterSummary[1]}” will be applied to ${masterSummary[2]} pages. Month names and text-frame content will remain unchanged. ${masterSummary[3]} assigned images will be preserved and empty photo frames will stay empty. Geometry, grid, fonts and decoration in the other months will be replaced; you can undo this action.\n\nApply master page?`;
    return `Майстер «${masterSummary[1]}» буде застосовано до ${masterSummary[2]} сторінок. Назви місяців і вміст текстових рамок залишаться власними. ${masterSummary[3]} призначених зображень буде збережено, а порожні фоторамки залишаться порожніми. Геометрію, сітку, шрифти й декор інших місяців буде замінено; дію можна скасувати.\n\nЗастосувати майстер-сторінку?`;
  }
  return source;
}

const reverseTranslations = new Map<string, string>();
for (const [source, translation] of Object.entries(TRANSLATIONS)) {
  reverseTranslations.set(translation.de, source);
  reverseTranslations.set(translation.en, source);
  reverseTranslations.set(translation.uk, source);
}

interface TranslationState {
  source: string;
  rendered: string;
}

const textStateByNode = new WeakMap<Node, TranslationState>();
const attributeStatesByElement = new WeakMap<Element, Map<string, TranslationState>>();

function parts(value: string): { before: string; core: string; after: string } {
  const matched = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  return matched
    ? { before: matched[1]!, core: matched[2]!, after: matched[3]! }
    : { before: "", core: value, after: "" };
}

function translateTextNode(node: Node): void {
  if (!node.nodeValue) return;
  if (node.parentElement?.closest(".page-scene, [data-no-translate], [contenteditable]")) return;
  const current = parts(node.nodeValue);
  const previous = textStateByNode.get(node);
  const source = previous && current.core === previous.rendered
    ? previous.source
    : TRANSLATIONS[current.core]
      ? current.core
      : reverseTranslations.get(current.core) ?? current.core;
  const translated = `${current.before}${translateInterfaceText(source)}${current.after}`;
  textStateByNode.set(node, { source, rendered: parts(translated).core });
  if (translated !== node.nodeValue) node.nodeValue = translated;
}

function translateAttribute(element: Element, attribute: string): void {
  if (element.closest(".page-scene, [data-no-translate], [contenteditable]")) return;
  const value = element.getAttribute(attribute);
  if (value === null) return;
  const current = parts(value);
  let states = attributeStatesByElement.get(element);
  if (!states) {
    states = new Map();
    attributeStatesByElement.set(element, states);
  }
  const previous = states.get(attribute);
  const source = previous && current.core === previous.rendered
    ? previous.source
    : TRANSLATIONS[current.core]
      ? current.core
      : reverseTranslations.get(current.core) ?? current.core;
  const translated = `${current.before}${translateInterfaceText(source)}${current.after}`;
  states.set(attribute, { source, rendered: parts(translated).core });
  if (translated !== value) element.setAttribute(attribute, translated);
}

const TRANSLATABLE_ATTRIBUTES = ["aria-label", "placeholder", "title", "alt", "label"] as const;

function translateElement(element: Element): void {
  // The page scene is the user's printable document, not application chrome.
  if (element.closest(".page-scene, [data-no-translate], [contenteditable]")) return;
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    translateAttribute(element, attribute);
  }
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE && child.nodeValue) {
      translateTextNode(child);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      translateElement(child as Element);
    }
  }
}

/** Keeps static and Vue-rendered interface copy in sync without touching document data. */
export function installInterfaceTranslator(root: Element): () => void {
  let translating = false;
  const translateRoot = (): void => {
    if (translating) return;
    translating = true;
    document.documentElement.lang = interfaceLanguage.value;
    translateElement(root);
    translating = false;
  };
  translateRoot();
  const observer = new MutationObserver((mutations) => {
    if (translating) return;
    translating = true;
    for (const mutation of mutations) {
      if (mutation.type === "characterData" && mutation.target.nodeValue) {
        translateTextNode(mutation.target);
      } else if (mutation.type === "attributes" && mutation.target instanceof Element) {
        translateElement(mutation.target);
      } else {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
            translateTextNode(node);
          }
          else if (node.nodeType === Node.ELEMENT_NODE) translateElement(node as Element);
        }
      }
    }
    translating = false;
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
  });
  const stopLanguageWatch = watch(interfaceLanguage, translateRoot, { flush: "post" });
  return () => {
    observer.disconnect();
    stopLanguageWatch();
  };
}
