# WordPress-плагин Georg-Kloster Calendar Workshop

Версия 1.3.71 получает календарь, тексты, переводы и иконы только из API Bible Desktop.
В Kalendar календарный HTTP API удалён. Существующие шорткоды, блоки Gutenberg,
темы, все наборы оформления поста и галерея икон сохранены.

## Обновление

1. Сначала обновить Bible Desktop и проверить его день, месяц, год и остальные
   используемые ответы по [контракту](CALENDAR-HTTP-API.md).
2. Скачать `/downloads/orthocal-1.3.71.zip` на сайте Kalendar и установить в WordPress.
3. В «Подключении» указать `https://bible-desktop.com` без `/api`.
4. Проверить конструктор, страницу с шорткодами, чтения и галерею.

Константа `ORTHOCAL_API_ORIGIN` больше не используется. Старый ключ Kalendar
сохранён как неактивная настройка, но не отправляется Bible Desktop. Календарные
запросы публичные и ограничиваются на стороне поставщика.

## Ресурсы и сборка

Все 16 оформлений и общие декоративные PNG подготовлены из существующих ресурсов до 384 px
и включены в плагин. Знаки Типикона и Monomakh Unicode с SIL OFL также включены;
они не требуют удалённого сервера. Иконы Bible Desktop кэшируются отдельно,
с сохранением ограничений размера, подписанного источника и лимита 200 МБ.

```bash
node scripts/build-wordpress-plugin.mjs --publish-downloads
```

Сборщик сначала готовит декоративные ресурсы, проверяет PHP (при заданном
`ORTHOCAL_PHP_BINARY`) и JS, затем создаёт один ZIP в `artifacts` и `public/downloads`.
Домен и ключ не включаются в архив как пользовательские данные.

## Проверка

```bash
node scripts/test-wordpress-plugin.mjs
node scripts/test-web-calendar.mjs
node scripts/test-calendar-api-docs.mjs
```

Первый сценарий использует одноразовый настоящий WordPress/SQLite из
`tmp/orthocal-wp/wordpress`. Годовой fixture генерируется существующим ядром
BibleDesktop из соседнего checkout; путь можно задать `BIBLE_CALENDAR_RUNTIME`.
Это тестовый источник, он не упаковывается и не запускается production-плагином.
Проверяются серверный рендер, безопасный медиакэш, навигация, чтения и все
оформления. Скриншоты можно направить в отдельную папку `ORTHOCAL_TEST_ARTIFACTS`.

Исходный публичный репозиторий плагина — `VAtapin/wp_orthodox_calendar`.
Новый tag/release и WordPress.org SVN в этой миграции автоматически не создаются.
