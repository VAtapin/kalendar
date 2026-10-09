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

Для `service` язык означает редакцию текста: `cu` или `cu-civil` (также доступен
`ru`). Веб-клиент выбирает `cu` для церковнославянского интерфейса и `cu-civil`
для остальных языков; календарный `uk/de/pl` не передаётся как редакция службы.
В параметре `month` используется целое число без ведущего нуля.

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

[ZIP текущего выпуска](/downloads/orthocal-1.3.73.zip).
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
