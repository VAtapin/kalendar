# Календарь через API Bible Desktop

Kalendar — редактор печатных календарей и клиент Bible Desktop. Собственного
календарного HTTP API, тарифов и ключей в Kalendar нет. Старые маршруты
`/api/v1/calendar`, `/calendar-demo`, `/calendar-texts`, `/calendar-access`
и серверная богослужебная библиотека удалены и возвращают HTTP 404.
Вход, сохранение макетов, шаблоны сеток, PDF и заказы редактора сохраняются.

## Единственный поставщик

```text
https://bible-desktop.com/api/v1/calendar/
```

Адрес поставщика задаётся `PUBLIC_API_URL=https://bible-desktop.com` в `.env`
Kalendar и полем «Адрес API» в WordPress-плагине. Корень указывается без `/api`.
Веб-календарь выполняет GET-запросы прямо к Bible Desktop, без посредника Kalendar.
Редактор, его предпросмотры и PDF используют проверенный годовой снимок
BibleDesktop `/api/v1/calendar/editor-year`; исходное XML-ядро остаётся только
для тестов и аудитов и не попадает в production-бандл.
Хранение и обновление снимков: [Календарные данные редактора](EDITOR-BIBLE-SNAPSHOTS.md).

| GET-маршрут Bible Desktop | Ответ |
| --- | --- |
| `today` | `{metadata, day}`; сегодня по Europe/Berlin |
| `day?date=2026-10-08&lang=uk&profile=typikon-strict` | `{metadata, day}` |
| `month?year=2026&month=10&view=summary` | `{metadata, year, month, pascha, days}` |
| `year?year=2026&view=summary` | `{metadata, year, pascha, days}` |
| `pascha?year=2026` | `{metadata, year, pascha}` |
| `upcoming?date=2026-10-08&limit=5&filter=main` | `{metadata, from, until, items}` |
| `service?date=2026-10-08&office=sixth-hour&expansion=full` | План службы Bible Desktop |

Поддерживаются годы 1900–2200, календарные языки `ru, cu, de, uk, pl`, профили
`typikon-strict, parish`. Гражданская дата — григорианская; старый стиль —
отдельное поле. Публичные маршруты ограничены 30 запросами в минуту. Авторизация,
квоты и доступность редакций текста определяются Bible Desktop; старый ключ
Kalendar не переносится в другой сервис.

Для `service?lang=...` язык означает редакцию текста: `cu`, `cu-civil` или `ru`.
Веб-календарь использует schema 2 с
`text_policy=calendar-language-v1&calendar_lang=ru`: для каждого произведения
приоритет `cu → cu-civil → ru`, независимо от языка интерфейса. Традиционный
текст отображается шрифтом Ponomar; гражданская запись и русский — встроенным
DejaVu Serif с корректными ударениями. Ответ старой schema 1 не заменяет этот контракт.
В параметре `month` используется целое число без ведущего нуля.

## Богослужение сегодня

Кнопка в веб-календаре и переход из карточки дня открывают страницу чтения:
`/web-calendar?view=worship&date=2025-11-09&office=third-hour&temple=george-victorious&lang=ru`.
Она обращается к `/api/v1/liturgical/templates/{office}` и
`/api/v1/liturgical/assignments/{office}` BibleDesktop.
Доступны first-hour, third-hour, sixth-hour, ninth-hour и liturgy. Дата,
служба, режим и храм сохраняются в ссылке; доступны оглавление и размер текста.

Постоянная основа Часа появляется сразу. Дневные назначения заполняют места
вставки и явно заменяют/исключают блоки; версии, контекст, источники и хеш полного
результата проверяются. Незавершённое назначение или ошибка не скрывают основу:
неопределённые места отмечаются отдельно. Новые назначения этих служб появляются
при следующем открытии или проверке без нового выпуска Kalendar.
Модульный API сейчас поддерживает cu-civil; шрифт соответствует фактической редакции
каждого блока. Для карточки дня сохраняется приоритет cu → cu-civil → ru.
Литургия пока показывает все 585 абзацев книжной основы Иоанна Златоуста с пометкой
о невыбранных дневных вариантах, отдельным приложением и списком 23 неопределённых
мест. Это не готовая служба дня; полную композицию продолжает разрабатывать BibleDesktop.

Номера зачал выводятся из reading.lectionary при точном соответствии и
единственной идентичности книга+номер. Неоднозначные варианты не угадываются.
Назначенные вставки и справочные тропари показаны отдельно; справочный текст
без insert=true не является назначением выбранного Часа. HTTP 409 означает
незавершённую композицию, а не отсутствие постоянного текста. Контракт отдельной
основы и дневных назначений согласован с BibleDesktop и подключён; клиент не
назначает справочные песнопения и не выбирает молитвы самостоятельно.

```bash
curl 'https://bible-desktop.com/api/v1/calendar/day?date=2026-10-08&lang=uk&profile=typikon-strict'
```

Другие прямые маршруты того же поставщика:

- `/api/liturgical/calendar-texts` — справочные тропари, кондаки, молитвы.
- `/api/liturgical/works` и `/api/liturgical/works/{slug}/versions/{language}` — произведения.
- `/api/calendar/icons` — каталог икон.
- `/api/calendar/icons/{icon}/images/{image}?preview=1` — компактное превью.
- `/api/translations` и маршруты книг/глав — библейский текст.

Описание обоих контрактов Bible Desktop, включая старый snake_case
`/api/calendar/day` для мобильного приложения, находится в его
`docs/KALENDAR_CONNECTION.md`. Форматы не смешиваются.

## WordPress

[Georg-Kloster Calendar Workshop на WordPress.org](https://wordpress.org/plugins/georg-kloster-calendar-workshop/).
Установите плагин через «Плагины → Добавить», найдя его по названию.
Новые версии доступны через стандартные обновления WordPress.
Шорткоды и Gutenberg-блоки сохранены. Календарные данные, тексты и иконы
плагин получает с одного настроенного адреса Bible Desktop. Знаки Типикона,
все 16 оформлений поста, общие декоративные ресурсы и Monomakh с лицензией включены в плагин как статические
ресурсы; их наличие не зависит от внешнего API. Декоративные PNG подготовлены
до 384 px. Галереи икон сохраняют локальный кэш и лимит 200 МБ.

## Порядок обновления

Сначала обновить Bible Desktop и проверить все используемые маршруты, затем
обновить Kalendar штатной сборкой и установить новый ZIP в WordPress.
Сборка Kalendar удаляет прежние неверсионированные обработчики из `dist`.
Старые ZIP с адресом удалённого API больше не публикуются; они сохранены в
локальной резервной копии перед миграцией.

Проверки Kalendar: `npm test`, `npm run typecheck`, `npm run build`,
`npm run test:calendar-api`, `node scripts/test-web-calendar.mjs`,
`node scripts/test-calendar-api-docs.mjs`, `npm run test:print-runtime`,
`node scripts/test-web-calendar-live.mjs`,
`npx playwright test e2e/editor-api-migration.spec.ts`.
API-проверка требует сборку и проверяет отсутствие обработчиков, HTTP 404
старых маршрутов и доступность шаблонов сеток редактора.
