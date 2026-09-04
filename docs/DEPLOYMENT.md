# Развёртывание `kalender.georg-kloster.ru`

Рабочий каталог на сервере:

```text
/var/www/vhosts/georg-kloster.ru/kalender.georg-kloster.ru
```

## Установка

```bash
cd /var/www/vhosts/georg-kloster.ru/kalender.georg-kloster.ru
npm ci
npm run build
mkdir -p storage
chmod 700 storage
```

Скопируйте `deploy/kalender-api.env.example` в `.env`, задайте настоящий SMTP‑пароль и оставьте файл доступным только системному пользователю сайта (`chmod 600 .env`). Каталог `storage` содержит общие проекты, подтверждённые e-mail и готовые PDF; он не должен быть доступен напрямую из веб‑корня.

## Plesk и nginx

Document root субдомена должен указывать на каталог `dist`. Директивы из `deploy/nginx-kalender.conf` добавляются в поле дополнительных директив nginx. Они направляют `/api/` в Node‑процесс, а все остальные неизвестные адреса — в `index.html`, поэтому ссылки вида `?shared=…` открываются корректно.

Установите `deploy/kalender-api.service` как systemd‑службу, заменив `GEORG_SYSTEM_USER` на системного пользователя подписки Plesk:

```bash
sudo cp deploy/kalender-api.service /etc/systemd/system/kalender-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now kalender-api
sudo systemctl status kalender-api
```

Проверка после установки:

```bash
curl https://kalender.georg-kloster.ru/api/health
```

Ответ должен содержать `"ok":true` и `"collaboration":true`.

## Как хранится работа

- До команды «Поделиться для совместной работы…» проект остаётся только в браузере и локальном файле `.kalendar`.
- Общая ссылка создаёт серверную копию проекта в `storage/shared-projects`.
- Один редактор удерживает аренду 45 секунд и обновляет её каждые 15 секунд. Нормальное закрытие вкладки освобождает её сразу.
- PDF передаётся блоками по 4 МБ с повторными попытками, собирается в `storage/pdf-exports` и отдаётся с HTTP Range, то есть браузер может продолжить прерванное скачивание.
- Админка и автоматическая квота хранилища сознательно не входят в этот минимальный этап; каталог `storage` уже отделён так, чтобы позднее считать объём и чистить файлы без изменения формата проектов.
