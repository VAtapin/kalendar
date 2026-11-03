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

Для saint ровно десять returned blocks с repeatCount=repeatIndex=1 вставляются один раз;
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

## Generic v2 и независимый Dormition admission

Прежний `ordinary-single-saint-temple-after-entrance-v1` поддержан без изменения
принятых слов. `ordinary-sourced-temple-after-entrance-v2` связывает старый
source pool0348 и typed templeSourceCapabilities inventory в новом version hash.
Внешняя carrier-формула и два base version поля остаются прежними.
Для saint sourceReviewVersion/sourceReviewHash остаются0348, а число частей10.
Канонические George/Nicholas подтверждаются kind/dedication/patronal identity;
Dormition нельзя представить как saint или произвольный custom профиль.

Для канонического dormition/memory-day-0009 требуется самостоятельный native-role
и order admission. Проверяются reviewed capability5980, object hashes b366/3865,
native/order proof hashes, source bindings и false oldSaintOnlyAdmissionUsed /
databaseBodyOrPublicFlagTreatedAsRoleAdmission. Прежний saint admission не используется
для подтверждения храмовых T/K Богородицы. Секция остаётся только source component.

Допускаются ровно девять уникальных returned parts. Последние два — now и
собственный temple-kontakion, без generic theotokos-kontakion/«Предстательство».
Клиент не составляет порядок: он сверяет возвращённые blocks с selection.order
существующего EntranceOrder. Храмовые T/K привязаны к точной whole-cu-minea-08-15,
редакции/whole-body/raw hashes, source blocks17/120, tones1/2, native range/text
hashes и role ownership proofs. Заголовок16 и литийный incipit57 не выбираются
вместо самостоятельного тропаря17; повторность утрени/литии не переносится.

```powershell
node --import tsx scripts/test-liturgy-troparia-api.mjs D:/Projekte/BibleDesktop/storage/app/worship-research/liturgy-dormition-installed-api --dormition
node --import tsx scripts/test-liturgy-troparia-api.mjs D:/Projekte/BibleDesktop/storage/app/worship-research/liturgy-troparia-v2-installed-api --parent D:/Projekte/BibleDesktop/storage/app/worship-research/liturgy-troparia-installed-api
```

Обе команды используют настоящие installed App HTTP captures, не ручную замену
версий JSON. Для private overlay нужна явная опция --overlay; такой прогон
не считается итоговой установленной проверкой. Fake positive fixtures не создаются.

Проверенный fc99 installed набор:12 HTTP responses/36 JSON sidecars+body
(два шаблона, четыре Dormition, четыре saint, legacy и held). Dormition2026/2027:
764 blocks/30 missing,9 choir parts,120 отрицательных мутаций реальных ответов PASS.
Saint-v2:765/30 и10 частей; legacy791/25, held754/32;60 отрицательных мутаций PASS.
Все10 reader/print/PDF составов partial и прошли Unicode body parity. Прямое
сравнение настоящих v1/v2 saint captures подтвердило неизменность слов, стилей,
порядка, повторов, sources, base nodes/groups и legacy; отличаются только
заявленные protocol versions. Прежние v1 captures отдельно прошли backward replay.
Никаких заявлений о полном годовом составе или выполненном deployment здесь нет.

Backend generic v2 опубликован в Git commit f8d9d933; это не production deployment.

## Canonical type6 / protocol v3

Consumer поддерживает `ordinary-sourced-temple-after-entrance-v3` рядом с v1/v2.
`sixSticheraOrderCapability=bacdf1dc…` входит в точный derived templateVersion
вместе с baseSourceReview и templeSourceCapabilities. Для actual6 отдельно
проверяются canonical George/Nicholas, actualPrincipalTypeCode6 и
type6RemappedTo7=false на обоих уровнях selection/capability, три pinned
witness/review/order proof hashes и точный порядок reviewed weekday capability.
Старый7 сохраняет source review0348, Dormition —5980 и9 частей. Старые source,
ownership, range/text, operation order/repeat, context и outer-wrapper guards
не заменяются общим разрешением v3. Receipt-поля не удаляются для подгонки версии.
Только проверенный actual6 v3 допускает отсутствие прежнего orderResolver:
его контракт возвращает отдельную reviewedOrderCapability/proof-chain.
Неизвестный resolver по-прежнему отвергается. Новых query fields нет.

```powershell
node --import tsx scripts/test-liturgy-troparia-api.mjs D:/Projekte/BibleDesktop/storage/app/worship-research/type6-canonical-port/installed-api --type6
```

Проверены31 HTTP bodies:2 шаблона,26 assignments и3 честных full-route409 без
blocks. Все26 reader/print/реальных PDF Unicode body parity PASS;644 мутации
реальных ответов отвергнуты.16 actual6 дают10 T/K частей и оставляют31 missing;
прежние saint/Dormition, legacy и held сохраняют свои30/25/32 missing.
Все Литургии остаются partial; полнота всего года не заявляется.

У5 Dormition request-sidecars `path` отсутствовал при захвате и добавлен
владельцем из действительного test contract. Harness отдельно читает
`DORMITION_REQUEST_PATH_ANNOTATION.json`, проверяет annotated SHA и неизменность
body/HTTP-sidecar SHA. Эти пути не описываются как captured request paths.
Браузер/production не используются; тела ответов и корпус в Git не добавляются.

## Dormition actual6 / protocol v4

В v4 добавлена точная совместная capability `dormitionSixSticheraJoin=1b34682c…`.
Derived section version включает ключи в порядке:
`dormitionSixSticheraJoin`, `dormitionSixSticheraSupplement` (pinned de8a0000…),
`baseSourceReview` (прежний034879…), `templeSourceCapabilities`,
`sixSticheraOrderCapability`. Supplement не добавляется в UI/response как новое
поле: это внутренний pin формулы. Версия секции0562e21d…, outer cb75cc71… .
Отозванный957 не принимается, включая полностью пересчитанный старый wrapper.

Dormition actual6 требует sourceReviewVersion/joinedSourceCapability1b,
actual6 и remapped=false на двух уровнях, точные reviewed join/resolver/order.
Дальше применяются прежние native Dormition recipes/ownership/range/text/kind
guards:9 частей, собственный K после now, без generic Theotokos K или saint-cast.
G/N6 продолжают bacdf, старый saint7 —0348, старый Dormition —5980.
v1/v2/v3 сохраняются; receipt-поля не вырезаются, query-контракт не меняется.

```powershell
node --import tsx scripts/test-liturgy-troparia-api.mjs D:/Projekte/BibleDesktop/storage/app/worship-research/canonical-dormition-six-port/CURRENT_HTTP_MANIFEST.json --v4
```

Harness читает только текущие18 triples из manifest и3-branch capture receipt,
проверяет реальные body SHA/HTTP/private/no-store/версии и отсутствие JSON patch
по owner receipt. Старые40 exports с957 не участвуют в положительном replay.
16 actual reader/print/PDF Unicode parity и543 отрицательных мутации PASS:
8 Dorm6 —763 блока/31 missing; G6/N6 —764/31; старые Dorm —764/30,
старый G7 —765/30. В manifest есть дублирующий old-Dorm alias;13 Dormition
replay — число captured cases, не13 новых дат. Все составы остаются partial.
Крест, отсутствие видимых источников и local-form UX не меняются.
