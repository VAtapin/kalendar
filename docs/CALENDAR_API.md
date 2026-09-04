# API православного календаря

Версия JSON-контракта: `1.0.0`. API рассчитывает Пасху, фиксированные и
переходящие календарные события, границы постов и правило трапезы на выбранный
день. Он не зависит от интерфейса редактора и доступен как TypeScript-модуль или
локальный HTTP-сервис.

Машиночитаемое описание маршрутов и схем находится в
[OpenAPI 3.1](./openapi.yaml).

> Поддерживаемый и проверяемый приложением диапазон: **1900–2200 годы**.
> Расчёт за пределами диапазона не является частью стабильного контракта.

## Быстрый запуск

В корне проекта:

```powershell
npm install
npm run api
```

Сервис будет доступен только на этом компьютере:

```text
http://127.0.0.1:8787
```

Чтобы выбрать другой порт в PowerShell:

```powershell
$env:CALENDAR_API_PORT = "8790"
npm run api
```

Проверка работы в браузере:

```text
http://127.0.0.1:8787/health
```

## Готовые запросы

### Получить один день

```http
GET /v1/day/2027-04-25?profile=typikon-strict
```

В браузере:

```text
http://127.0.0.1:8787/v1/day/2027-04-25?profile=typikon-strict
```

PowerShell:

```powershell
$day = Invoke-RestMethod `
  "http://127.0.0.1:8787/v1/day/2027-04-25?profile=typikon-strict"
$day.fasting.foodRule.label
$day.events | Select-Object title, typeCode, priority
```

`curl`:

```bash
curl "http://127.0.0.1:8787/v1/day/2027-04-25?profile=typikon-strict"
```

JavaScript:

```js
const response = await fetch(
  "http://127.0.0.1:8787/v1/day/2027-04-25?profile=typikon-strict",
);
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const day = await response.json();
console.log(day.date, day.fasting.foodRule.label, day.events);
```

Сокращённый пример ответа:

```json
{
  "date": "2027-04-25",
  "oldStyleDate": "2027-04-12",
  "weekday": 0,
  "events": [
    {
      "id": "memory-day-0002:2027-04-25",
      "title": "Вход Господень в Иерусалим",
      "typeCode": 1,
      "priority": 925,
      "ruleKind": "pascha-relative"
    }
  ],
  "fasting": {
    "date": { "year": 2027, "month": 4, "day": 25 },
    "profileId": "typikon-strict",
    "period": "great-lent",
    "foodRule": {
      "id": "fish",
      "label": "разрешается рыба",
      "color": "#3a6f85"
    },
    "memorial": false,
    "reason": "Вход Господень в Иерусалим: разрешается рыба",
    "sourceUrls": [
      "https://otrada-i-uteshenie.ru/kalendar/",
      "https://azbyka.ru/days/p-kalendar-postov-i-trapez"
    ]
  }
}
```

`weekday` использует нумерацию JavaScript: `0` — воскресенье, `1` — понедельник,
…, `6` — суббота.

### Получить полный год

```http
GET /v1/year/2027?profile=parish
```

```powershell
$year = Invoke-RestMethod `
  "http://127.0.0.1:8787/v1/year/2027?profile=parish"
$year.pascha
$year.fastingPeriods
$year.days.Count
```

Ответ содержит:

- `metadata` — версии API, данных и правил;
- `year` и `pascha`;
- `fastingPeriods` — многодневные посты, пересекающие гражданский год;
- `days` — все 365 или 366 дней в том же формате, что и ответ `/v1/day`.

Годовой ответ велик. Если нужен только один день, следует использовать
`/v1/day`, а не загружать весь год.

### Получить дату Пасхи

```http
GET /v1/pascha/2027
```

```powershell
Invoke-RestMethod "http://127.0.0.1:8787/v1/pascha/2027"
```

Ответ:

```json
{
  "metadata": { "apiVersion": "1.0.0" },
  "year": 2027,
  "pascha": "2027-05-02"
}
```

### Получить состояние и версии

```http
GET /health
```

Также поддерживается `GET /v1`. В ответе важны:

- `apiVersion` — версия структуры JSON;
- `calendarDataSource` — имя набора календарных событий;
- `fastingProfileId` — применённый профиль;
- `fastingRulesVersion` — версия алгоритма постов;
- `sourceUrls` — справочные источники правил.

## Профили поста

Параметр `profile` может иметь одно из двух значений:

| Значение | Назначение |
| --- | --- |
| `typikon-strict` | Строгая монастырская мера с сухоядением и днями полного воздержания. Профиль по умолчанию. |
| `parish` | Смягчённое информационное отображение для мирян. Это не персональное предписание и не единая обязательная приходская норма. |

Если `profile` не передан, используется `typikon-strict`. В текущей версии
неизвестное значение также заменяется на `typikon-strict`; клиенту лучше заранее
проверять допустимые значения, потому что это поведение может стать строгой
ошибкой в следующей версии API.

## Идентификаторы трапезы

Поле `fasting.foodRule.id` принимает значения:

| `id` | Значение |
| --- | --- |
| `no-fast` | поста нет |
| `fast` | постный день без рыбы |
| `fish` | разрешается рыба |
| `oil` | варёная пища с маслом (елеем) |
| `boiled-no-oil` | варёная пища без масла (елея) |
| `dry-eating` | сухоядение |
| `strict-fast` | строгий пост / полное воздержание по правилу дня |
| `dairy-eggs` | разрешаются молочные продукты и яйца |

`fasting.memorial` — отдельный логический признак. Он не отменяет рассчитанное
правило пищи: интерфейс может одновременно показать трапезу и поминовение.
Внутренний идентификатор `memorial` зарезервирован для графического маркера, но
в HTTP-поле `fasting.foodRule.id` не возвращается.

## Идентификаторы многодневных постов

- `great-lent` — Великий пост;
- `apostles-fast` — Петров пост;
- `dormition-fast` — Успенский пост;
- `nativity-fast` — Рождественский пост.

## Календарные события

Каждый элемент `events` содержит:

- `id` — стабильный идентификатор экземпляра события в конкретную дату;
- `title`, при наличии `shortTitle` и `veryShortTitle`;
- `typeCode` — категория записи исходного календаря;
- `priority` — приоритет для отбора событий в печатную ячейку;
- `ruleKind` — способ получения даты (`fixed-julian`, `pascha-relative` и т. п.);
- `styleToken` — необязательный стилевой маркер локального события.

API намеренно возвращает полный список событий. Ограничение числа малых памятей
по вместимости печатной ячейки выполняет модуль компоновки, а не календарный API.

## Ошибки HTTP

```json
{ "error": "invalid_date" }
```

Возможные ответы:

- `400 invalid_date` — неверная дата или формат, отличный от `YYYY-MM-DD`;
- `400 invalid_year` — год вне диапазона `1900–2200` для маршрутов года и Пасхи;
- `404 not_found` — неизвестный маршрут;
- `405 method_not_allowed` — используется метод, отличный от `GET` или `OPTIONS`.

Успешные ответы имеют `Content-Type: application/json; charset=utf-8` и могут
кэшироваться один час. Для локальной интеграции разрешены CORS-запросы.

## TypeScript API без HTTP

```ts
import {
  createCalendarPublicApi,
  createOrthodoxCalendarApiFromXml,
} from "./src/calendar";

const engine = createOrthodoxCalendarApiFromXml(
  xml,
  "MemoryDays.xml",
  {
    profileId: "typikon-strict",
    monasteryEvents: [],
  },
);

const api = createCalendarPublicApi(engine);

const day = api.getDay({ year: 2027, month: 4, day: 25 });
const year = api.getYear(2027);
const pascha = api.getPascha(2027);
```

Низкоуровневый движок дополнительно предоставляет:

```ts
engine.getFasting({ year: 2027, month: 4, day: 25 });
engine.getFastingPeriods(2027);
engine.clearCache();
```

Локальные монастырские события передаются через `monasteryEvents` и сливаются с
XML в памяти без изменения исходного файла.

## Точность и ограничения

Границы постов и даты праздников рассчитываются, а не копируются из готовой
таблицы одного года: фиксированные даты переводятся из юлианского календаря с
учётом изменения разницы календарей, переходящие даты строятся от православной
Пасхи. Однако наличие ссылок в `sourceUrls` означает справочную основу, а не
сертификацию каждого ответа источниками.

Дата Пасхи, крупные фиксированные и переходящие праздники и границы четырёх
многодневных постов имеют высокий уровень уверенности в диапазоне 1900–2200.
Полный перечень малых памятей зависит от поставляемого `MemoryDays.xml` и не
обновляется автоматически. Дневная мера трапезы имеет известные расхождения и
не должна называться стопроцентно точной; подробности приведены в
[аудите точности](./CALENDAR_ACCURACY_AUDIT.md).

Личная мера поста, благословение духовника, состояние здоровья, беременность,
возраст и местные храмовые послабления этим API не определяются.
