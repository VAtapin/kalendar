# Развёртывание `kalender.georg-kloster.ru` в Plesk

Производственная версия состоит из статического интерфейса в `dist` и небольшого
PHP-обработчика в `dist/api`. PHP обслуживает подтверждение e-mail, общие ссылки,
блокировку редактирования, настройки, общие макеты и загрузку PDF. Отдельный
Node.js-процесс, systemd-служба и открытый порт приложению не нужны.

Рабочий каталог:

```text
/var/www/vhosts/georg-kloster.ru/kalender.georg-kloster.ru
```

## Первая сборка и обновления

Команды выполняются системным пользователем сайта, не `root`:

```bash
cd /var/www/vhosts/georg-kloster.ru/kalender.georg-kloster.ru
git pull --ff-only origin main
nodenv local 22
npm ci --include=dev
npm run build
mkdir -p storage
chmod 700 storage
```

Node.js используется только командой сборки. После завершения `npm run build`
никакой Node.js-процесс не запускается. При необходимости освободить место можно
выполнить `npm prune --omit=dev`; на работу опубликованного сайта это не влияет.

При первой установке создайте конфигурацию:

```bash
cp -n deploy/kalender.env.example .env
chmod 600 .env
nano .env
```

В `.env` заменяются `CALENDAR_OWNER_EMAIL`, `SMTP_PASSWORD` и, если почтовый
ящик другой, `SMTP_USER`/`MAIL_FROM`. Файл находится выше `dist` и не выдаётся
посетителям сайта.

## Настройки Plesk

Для субдомена включите обычный режим сайта с PHP 8.1 или новее и стандартный
режим проксирования nginx через Apache. В поле **Document root** укажите:

```text
/var/www/vhosts/georg-kloster.ru/kalender.georg-kloster.ru/dist
```

Если поле принимает путь относительно каталога подписки:

```text
kalender.georg-kloster.ru/dist
```

Поле **Дополнительные директивы nginx** должно быть пустым. Маршрутизация
`/api/...` уже находится в `dist/.htaccess`; Plesk передаёт эти запросы обычному
PHP-обработчику. Файл `dist/.user.ini` устанавливает лимиты для больших общих
проектов и длительных операций.

Максимально допустимый размер HTTP-запроса в Plesk можно оставить 128 МБ. PDF
передаётся частями по 4 МБ, а общий проект ограничен 100 МБ.

## Проверка

```bash
curl -fsS https://kalender.georg-kloster.ru/api/health
```

Ожидаемый ответ:

```json
{"ok":true,"collaboration":true,"runtime":"php"}
```

## Хранение данных

- До команды «Поделиться для совместной работы…» проект остаётся в браузере и
  локальном файле `.kalendar`.
- Общие проекты находятся в `storage/shared-projects`.
- Аренда редактирования хранится в `storage/leases`, действует 45 секунд и
  продлевается открытым редактором каждые 15 секунд.
- Подтверждённые адреса и настройки находятся в
  `storage/email-identities.json`.
- Общие макеты находятся в `storage/calendar-grid-templates.json`.
- PDF собираются потоково в `storage/pdf-exports` и скачиваются с поддержкой
  продолжения прерванной загрузки.

Каталог `storage` находится вне `dist`, поэтому nginx и Apache не могут отдать
его содержимое напрямую.
