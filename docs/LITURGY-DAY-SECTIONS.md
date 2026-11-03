# Дневные секции Литургии в читателе

Kalendar применяет только операции из ответа BibleDesktop. Справочные тексты,
календарные названия и reference-only материалы не становятся вставками.

Для Chrysostom прежние квитанции acceptance=approved/profileStatus сохраняют
свой guard. Отдельный узкий guard поддерживает опубликованные source-component
квитанции Херувимской, общего обычного Трисвятого и буднего входного стиха,
а также два существующих weekday/trisagion контракта из того же ответа.
Проверяются известный section/rule/scope, язык/точные sourceVersions,
контекст даты/храма/чина, source class/proof/calendar hash, false whole/date flags,
версии шаблона/секции, индексы операций, известные узлы и composedBlocksHash.
Неизвестная секция или явно неподтверждённый старый acceptance не допускается.

Для Basil шаблон с dayComponent разрешает передать выбранный храм только в
датированный GET assignments. Без dayComponent старый запрос не меняется.
POST имён сохраняет внешний templateVersion и приватный JSON body; имён в URL нет.
Held receipt оставляет gate незаполненным. Selected receipt materialize-reviewed-
conditional-at-parent-day-choice вставляет ровно опубликованные blocks дочернего
ordinary-standard-trisagion в точный gate. Проверяются outer/base/child версии,
исходные gate/input/required-contract hashes, proof binding, hash и дословное
равенство child blocks, occurrence IDs и условия сохранения sourceFrame.
Повторы уже раскрыты источником и повторно не умножаются. Условный прототип
не меняется; выбранная ветвь не дублируется среди остальных невыбранных вариантов.

Источник и пользовательские значения проверяются независимо. userSections
сохраняют проверку исходных operationIndexes, inputHash/temple, node/contract
hashes, буквальных форм и source/user origins. После независимых проверок
сверяются общий порядок blocks, оставшиеся missing и hash доступного состава.
GET с пользовательскими значениями без ввода отклоняется. Неизвестные операции,
подмена узла, слова/повтора/версии или повышение whole/date флагов отклоняются.
Все новые результаты остаются partial, а пробелы видны и в читателе, и в PDF.
Печать использует тот же основной article; PDF захватывает его без прочих вариантов.

## Проверка реальных ответов

```powershell
node --import tsx scripts/test-liturgy-day-api.mjs D:/Projekte/BibleDesktop/storage/app/worship-research/liturgy-day-runtime/api/manifest.json
```

Скрипт только читает локальные verbatim kernel captures: проверяет SHA-256/bytes
всех ответов и request/HTTP sidecars, затем запускает настоящий клиентский
fetch/guard/reader/PDF exporter через Node DOM adapter, без браузера и сети.
Состав блоков сравнивается с операциями ответа, текст snapshot — с отображением,
а логический Unicode body созданного PDF — со snapshot через KalendarBody/ActualText.
Личные данные не сохраняются и не выводятся; примеры fixture — публичные словарные
формы, а не утверждение о действующих клириках. PDF создаются только в памяти.

Проверенный manifest ed5e105122b21b287d4d6ed58abb01c667d0a5cfb81fff853c0253fbfd15598a
содержит 11 ответов (2 templates + 9 assignments). Кандидат baseline c0d1213:
Chrys на 7 датах даёт 748–791 исходный блок/25–33 незаполненных места;
Basil selected GET — 734/35, POST с четырьмя буквальными формами — 738/31.
Это совместимость клиента с кандидатом, не публикация backend и не число полных
служб 2026–2027. После изменения wrapper/child versions проверку повторяют на
окончательных согласованных ответах. Сервер публикует владелец после backend release.
