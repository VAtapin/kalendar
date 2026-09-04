# API православного календаря

Версия контракта: `1.0.0`. Расчёт не зависит от интерфейса редактора и доступен как TypeScript API или локальный HTTP-сервис.

## Запуск HTTP-сервиса

```bash
npm run api
```

По умолчанию сервис слушает `127.0.0.1:8787`. Порт задаётся переменной `CALENDAR_API_PORT`.

Маршруты:

- `GET /health` — состояние и версия правил;
- `GET /v1/day/2027-04-25?profile=typikon-strict` — день, события, старый стиль и трапеза;
- `GET /v1/year/2027?profile=parish` — полный год;
- `GET /v1/pascha/2027` — дата Пасхи.

Профили: `typikon-strict` (строгий монастырский устав) и `parish` (смягчённое информационное отображение). Каждый ответ содержит версию правил и ссылки на использованные справочные таблицы. Медицинские и личные послабления API не назначает.

## Встраивание

```ts
import {
  createCalendarPublicApi,
  createOrthodoxCalendarApiFromXml,
} from "./src/calendar";

const api = createCalendarPublicApi(
  createOrthodoxCalendarApiFromXml(xml, "MemoryDays.xml", {
    profileId: "typikon-strict",
    monasteryEvents: [],
  }),
);

const day = api.getDay({ year: 2027, month: 4, day: 25 });
```

Локальные монастырские события передаются при создании API и сливаются с XML без изменения исходного файла.
