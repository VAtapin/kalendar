# Автозагрузка немецких текстов Orthodoxia.de

Скрипт `scripts/download-orthodoxia-de.ps1` самостоятельно получает 19
канонических страниц раздела `https://orthodoxia.de/gebete/gebetbuch`:
молитвы, каноны, три акафиста, Пасхальный Часослов и наборы тропарей/кондаков.
Он использует только HTTPS-адреса `orthodoxia.de`, заданные в самом файле;
никакие внешние ссылки со страниц не переходятся и не выполняются.

Запуск из корня репозитория:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\download-orthodoxia-de.ps1
```

Получится каталог `artifacts\orthodoxia-de-ГГГГ-ММ-ДД\` с тремя типами файлов:

- `raw-html\` — неизменённые ответы источника;
- `download-report.json` — URL, SHA-256, число извлечённых блоков и ошибки;
- `orthodoxia-de-corpus.json` — корпус формата `liturgical:import-library`.
- `orthodoxia-de-import.zip` — компактный архив для загрузки на сервер; в нём
  есть корпус и инструкция.

Скрипт делает паузу 1,2 секунды между запросами и до трёх попыток для страницы.
При ошибке хотя бы одной страницы он сохраняет отчёт, завершается ошибкой и не
создаёт готовый корпус. После устранения причины повторите запуск с `-Force`.
`-AllowPartial` предназначен только для локального изучения и не должен
использоваться для производственного импорта.

После полной загрузки корпус нужно проверить: в отчёте должно быть
`downloaded_pages: 19`, а `errors` — пустой массив. Затем загрузите каталог на
сервер Bible Desktop и выполните:

```sh
cd /var/www/vhosts/bible-desktop.com/httpdocs
/opt/plesk/php/8.4/bin/php -d memory_limit=512M artisan liturgical:import-library /полный/путь/orthodoxia-de-corpus.json --publish
/opt/plesk/php/8.4/bin/php artisan optimize:clear
```

Импорт создаёт только немецкие (`de`) версии. Он не заменяет русские и
церковнославянские тексты и не публикует подмену языка, если немецкая страница
не была загружена.
