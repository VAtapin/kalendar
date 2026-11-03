# Отдельный carrier тропарей и кондаков

Новый `general-ordinary-entrance-troparia-kontakia` подключён отдельным guard.
Прежние четыре семейства дневных частей, civil/Basil/Presanctified и книжное
разбиение Октоиха не меняются. У старых шаблонов без новой секции прежний путь
сохраняется.

## Версии и источники

`tropariaBaseTemplateVersion` хранит внешний version родителя Root4.
Старый `baseTemplateVersion` остаётся прежним. Новый внешний `templateVersion`
проверяется как hash объекта `{dayTemplateVersion, tropariaSectionVersion}`;
ответ обязан совпадать с обеими родительскими версиями и внешним шаблоном.
Проверяется ровно один target `troparia-kontakia` с ролью choir и существующей
parallel group entrance-prayer. Никакие другие места carrier не заполняет.

Общий `templateSourcesHash` описывает MAIN template.sourceVersions.
Hash подтверждённой секции описывает её статический source pool. Динамические
sourceVersions квитанции содержат реальные источники выбранных песнопений,
включая own-day Menaion; их не требуют равными статическому pool. Каждый block
должен иметь identity в квитанции и общем ответе, точную связь с reference,
source range/ownership и ролью. Для range проверяется исходный textSha256,
для own-day — memory/role/binding/ownership proof. Порядок берётся только из
selection.order существующего EntranceOrder; клиент не вычисляет память,
песнопения или их очерёдность из даты.

Ровно десять returned blocks с repeatCount=repeatIndex=1 вставляются один раз;
исходные occurrence IDs, слова и стили сохраняются. Source/user origins нельзя
подменить. Context, scope, версии, hashes, operation indexes, remaining missing
и false whole/date/public/antiphon flags проверяются. Ошибки сохраняют постоянную
основу с незаполненными местами, без reference-only подстановок.

Legacy-среда использует прежнюю секцию и `preservedLegacySections`, без второй
T/K операции. Held-четверг остаётся незаполненным. Reader/browser print/PDF
получают один основной body; допуска полной службы/даты/public нет.

## Проверка

```powershell
node --import tsx scripts/test-liturgy-troparia-api.mjs D:/Projekte/BibleDesktop/storage/app/worship-research/liturgy-troparia-installed-api
```

Скрипт читает настоящие HTTP response/request/HTTP sidecars, сверяет body SHA-256,
HTTP200/private/no-store и отметку локального установленного App. Ни сервер, ни
браузер не используются. Он запускает существующий fetch/guards/reader, сверяет
ordered source blocks, происхождение/parallel group, создаёт PDF только в памяти
и сравнивает его логический Unicode body с snapshot. Для каждого выбранного
реального ответа отрицательные проверки меняют версии, target, words/reseal,
order, source/ownership, repeat, admission, legacy duplication и parallel group.
Тестовые богослужебные ответы не выдумываются и корпус не копируется в Kalendar.

Опционально вместо каталога можно передать manifest overlay-кандидата с cases.
Такой прогон проверяет кандидата и не заменяет итоговый прогон установленного App.
`productionInstalled=true` в локальном HTTP sidecar означает установленный App
в локальном тесте; это не публикация и не проверка production-сервера.

Проверенный installed пакет: 9 HTTP triples (27 файлов), шесть selected примеров
2026–2027 с 765 исходными blocks/30 missing, legacy-среда 791/25, held-четверг
754/32. Все восемь reader/PDF составов — partial; дословная сохранность blocks,
логического PDF body и 90 отрицательных мутаций реальных ответов PASS.
Прежние legacy operations/missing/verifiedSections побайтно совпали с Root4;
main nodes и parallelGroups также сохранены. Отдельный прежний Root4 replay
(семь Chrys + Basil GET/POST) прошёл без изменения его контрактов.
