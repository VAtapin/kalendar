# Импорт Open Access икон

Импортёр находится в `scripts/import-open-access-icons.mjs`. Он запускается
отдельно для одного источника и по умолчанию сохраняет данные вне публичного
каталога в `storage/open-access-icons`.

## Режимы

Сначала на сервере можно проверить только метаданные:

```bash
node scripts/import-open-access-icons.mjs --source=met --query="orthodox icon" --limit=50 --dry-run
```

Фактическая загрузка оригиналов выполняется только без `--dry-run`:

```bash
node scripts/import-open-access-icons.mjs --source=cleveland --query="byzantine icon" --limit=100
```

Допустимые значения `--source`:

```text
wikimedia met cleveland smithsonian nationalmuseum nga getty aic walters europeana
```

Специальные параметры:

- `smithsonian` требует `SMITHSONIAN_API_KEY`;
- `europeana` требует `EUROPEANA_API_KEY`;
- `nationalmuseum` требует `--record-url=https://...` с URL конкретных карточек;
- `nga` читает официальные `objects.csv` и `published_images.csv`, либо JSON из `--input`;
- `walters` читает официальный статический JSON из `--input`;
- `--existing-catalog` задаёт существующий каталог Azbyka для cross-source дедупликации.

Импортёр принимает только записи с иконографическими признаками и явно
разрешёнными правами: CC0, Public Domain Mark, CC BY или CC BY-SA. Записи с
NC/ND, `Usage Conditions Apply`, `InC`, Copyrighted, Other или неизвестными
правами отбрасываются. Сохраняются исходная карточка, URL, inventory number,
license, credit line, SHA-256 и perceptual hash, если формат изображения может
быть декодирован встроенным runtime.

Изображения сохраняются content-addressed в `originals/{sha256}.ext`.
Повторный source ID/URL, совпадающий SHA-256 или совпадающий pHash не создаёт
новую запись. Совпадение с существующим Azbyka-файлом только фиксируется в
журнале как `same-image-do-not-copy`; замена существующей записи автоматически
не выполняется.

Журнал имеет формат JSON Lines: `import.log.jsonl`. Итоговая статистика печатается
в stdout и сохраняется в `catalog.json` после обычного запуска. `--dry-run` не
создаёт каталог, журнал, lock-файл и не загружает изображения.
