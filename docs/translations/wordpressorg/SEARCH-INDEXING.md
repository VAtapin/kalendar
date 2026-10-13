# Поиск опубликованного плагина WordPress.org

Проверено 13.10.2026 в 14:13 UTC. Плагин `georg-kloster-calendar-workshop`, версия 1.3.78, добавлен в каталог 11.10.2026.

## Подтверждённые результаты

Публичный `query_plugins` API с `request[locale]` воспроизводит проблему из WordPress «Добавить плагины». Запрошены до 100 результатов; во всех проверках выдача помещается на одной странице.

| Язык | Запрос | Всего результатов | Наш плагин |
| --- | --- | ---: | --- |
| ru_RU | Православный | 3 | отсутствует |
| ru_RU | православный календарь | 1 | отсутствует |
| ru_RU | богослужебные | 0 | отсутствует |
| uk | православний | 0 | отсутствует |
| de_DE | orthodoxer | 0 | отсутствует |
| ru_RU | orthodox | 15 | присутствует |
| ru_RU | Georg-Kloster | 2 | присутствует |

Контрольный поиск по бренду возвращает русское краткое описание: «Православный календарь для WordPress: праздники, посты, памяти святых, чтения, богослужебные тексты и блоки Gutenberg.». Русская карточка также показывает переведённый Readme. Следовательно, переводы опубликованы, но наличие перевода в карточке ещё не подтверждает его доступность поиску.

Проверяемый запрос: [публичный API: православный календарь, ru_RU](https://api.wordpress.org/plugins/info/1.2/?action=query_plugins&request%5Bsearch%5D=%D0%BF%D1%80%D0%B0%D0%B2%D0%BE%D1%81%D0%BB%D0%B0%D0%B2%D0%BD%D1%8B%D0%B9+%D0%BA%D0%B0%D0%BB%D0%B5%D0%BD%D0%B4%D0%B0%D1%80%D1%8C&request%5Blocale%5D=ru_RU&request%5Bper_page%5D=100).

## Причина и ограничения вывода

[Официальный FAQ, How long will it take for my plugin to show up in search?](https://developer.wordpress.org/plugins/wordpress-org/plugin-developer-faq/#how-long-will-it-take-for-my-plugin-to-show-up-in-search) указывает обычный срок **6–14 дней после публикации в SVN**. На момент проверки прошло два дня. Наиболее вероятное объяснение — незавершённая индексация нового плагина и его переводов. Не доказано, что индекс повреждён: его внутреннее состояние доступно только WordPress.org.

В [исходном коде поиска](https://github.com/WordPress/wordpress.org/blob/trunk/wordpress.org/public_html/wp-content/plugins/plugin-directory/class-plugin-search.php) предусмотрены локализованные title/excerpt/description/all_content. [Синхронизация переводов](https://github.com/WordPress/wordpress.org/blob/trunk/wordpress.org/public_html/wp-content/plugins/plugin-directory/class-plugin-directory.php) сохраняет переведённые поля для индекса отдельно от отображения карточки. [Плановое задание](https://github.com/WordPress/wordpress.org/blob/trunk/wordpress.org/public_html/wp-content/plugins/plugin-directory/jobs/class-translation-sync.php) предназначено для ежедневной синхронизации. Выполнение этих заданий на production WordPress.org локально не проверяется.

В расширенном просмотре карточки под аккаунтом владельца есть управление выпуском, владельцем и закрытием плагина, но нет кнопки синхронизации переводов или переиндексации. Эти настройки не изменялись.

## Следующий шаг

Повторить обычные русские запросы после завершения срока индексации — не позднее 25.10.2026. Если отсутствие сохранится, обратиться к Plugins Team с просьбой проверить синхронизацию ru_RU/de_DE/uk и поисковый индекс. Официальный контакт: `plugins@wordpress.org`, указан в [FAQ](https://developer.wordpress.org/plugins/wordpress-org/plugin-developer-faq/#how-do-i-contact-the-plugins-team).

Сообщение не отправлялось. Никакого автоматического мониторинга не создано. Изменение названия, меток, исходников или повторное утверждение уже опубликованных переводов не выдаётся за исправление индексации.

Готовый текст обращения, если проблема сохранится:

> Subject: Localized search indexing for georg-kloster-calendar-workshop
>
> Hello Plugins Team,
>
> Could you check the localized search indexing of georg-kloster-calendar-workshop? The plugin was added on 11 October 2026. Its approved Russian Readme and short description are visible, but the query_plugins API with locale ru_RU does not return it for “Православный” or “православный календарь”. A control search for “Georg-Kloster” returns the plugin with its Russian short description. Similar checks for “православний” (uk) and “orthodoxer” (de_DE) also return no matching plugin.
>
> Please check whether the translated fields have been synchronized and included in the search index. The initial reproducible results were recorded on 13 October 2026; the queries should be repeated before sending this request.
>
> Thank you.

Deployment не требуется: это диагностика публичного поиска; runtime плагина, языковые пакеты и сайт не изменены.
