<?php
declare(strict_types=1);

/**
 * Date-bound service plan.
 *
 * The calendar owns the date, cycles and selected calendar texts.  Consumers
 * own their reader layout and may combine this plan with a full Horologion
 * edition.  The plan never pretends that a missing feast proper is a generic
 * weekday text: unresolved proper slots remain explicit in the response.
 */

function calendar_service_days_between(string $from, string $to): int {
    return (int) (new DateTimeImmutable($from, new DateTimeZone('UTC')))
        ->diff(new DateTimeImmutable($to, new DateTimeZone('UTC')))->format('%r%a');
}

/** @return array{title:string, text:string, source:array<int, array<string,mixed>>} */
function calendar_service_expansion(string $id, string $mode, string $language): array {
    $entries = [
        'ru' => [
            'come-worship' => ['short' => 'Придите, поклонимся: (3). И три поклона.', 'full' => "Придите, поклонимся Царю нашему Богу.\nПридите, поклонимся и припадем ко Христу, Царю нашему Богу.\nПридите, поклонимся и припадем Самому Христу, Царю и Богу нашему.\nИ три поклона.", 'title' => 'Придите, поклонимся'],
            'trisagion' => ['short' => 'Трисвятое.', 'full' => 'Святый Боже, Святый Крепкий, Святый Бессмертный, помилуй нас. (Трижды.)', 'title' => 'Трисвятое'],
            'lords-prayer' => ['short' => 'Отче наш:', 'full' => 'Отче наш, Сущий на небесах! Да святится имя Твоё; да придёт Царствие Твоё; да будет воля Твоя и на земле, как на небе; хлеб наш насущный дай нам на сей день; и прости нам долги наши, как и мы прощаем должникам нашим; и не введи нас в искушение, но избавь нас от лукавого.', 'title' => 'Отче наш'],
            'glory-now' => ['short' => 'Слава, и ныне:', 'full' => 'Слава Отцу и Сыну и Святому Духу, и ныне и присно и во веки веков. Аминь.', 'title' => 'Слава, и ныне'],
        ],
        'cu-civil' => [
            'come-worship' => ['short' => 'Приидите, поклонимся: трижды.', 'full' => "Приидите, поклонимся Цареви нашему Богу.\nПриидите, поклонимся и припадем Христу, Цареви нашему Богу.\nПриидите, поклонимся и припадем Самому Христу, Цареви и Богу нашему.", 'title' => 'Приидите, поклонимся'],
            'trisagion' => ['short' => 'Трисвятое.', 'full' => "Святый Боже, Святый Крепкий, Святый Безсмертный, помилуй нас. (Трижды.)\nСлава Отцу и Сыну и Святому Духу, и ныне и присно и во веки веков. Аминь.\nПресвятая Троице, помилуй нас; Господи, очисти грехи наша; Владыко, прости беззакония наша; Святый, посети и исцели немощи наша, имене Твоего ради.\nГосподи, помилуй. (Трижды.)\nСлава Отцу и Сыну и Святому Духу, и ныне и присно и во веки веков. Аминь.", 'title' => 'Трисвятое'],
            'lords-prayer' => ['short' => 'По Отче наш:', 'full' => 'Отче наш, Иже еси на Небесех, да святится имя Твое, да приидет Царствие Твое, да будет воля Твоя, яко на Небеси и на земли. Хлеб наш насущный даждь нам днесь; и остави нам долги наша, якоже и мы оставляем должником нашим; и не введи нас во искушение, но избави нас от лукаваго.', 'title' => 'Отче наш'],
            'glory-now' => ['short' => 'Слава, и ныне:', 'full' => 'Слава Отцу и Сыну и Святому Духу, и ныне и присно и во веки веков. Аминь.', 'title' => 'Слава, и ныне'],
        ],
        'cu' => [
            // Traditional spelling and titla come from the Ponomar electronic edition.
            'come-worship' => ['short' => 'Прїиди́те, поклони́мсѧ: Покло́ны трѝ.', 'full' => "Прїиди́те, поклони́мсѧ цр҃е́ви на́шемꙋ бг҃ꙋ.\nПрїиди́те, поклони́мсѧ и҆ припаде́мъ хрⷭ҇тꙋ̀, цр҃е́ви на́шемꙋ бг҃ꙋ.\nПрїиди́те, поклони́мсѧ и҆ припаде́мъ самому̀ хрⷭ҇тꙋ̀, цр҃е́ви и҆ бг҃ꙋ на́шемꙋ.\nПокло́ны трѝ.", 'title' => 'Прїиди́те, поклони́мсѧ'],
            'trisagion' => ['short' => 'Трист҃о́е.', 'full' => 'Ст҃ы́й бж҃е, ст҃ы́й крѣ́пкїй, ст҃ы́й безсме́ртный, поми́лꙋй на́съ. Три́жды.', 'title' => 'Трист҃о́е'],
            'lords-prayer' => ['short' => 'По Ѻ҆́ч҃е на́шъ:', 'full' => 'Ѻ҆́ч҃е на́шъ, и҆́же є҆сѝ на нб҃сѣ́хъ, да свѧти́тсѧ и҆́мѧ твоѐ, да прїи́детъ црⷭ҇твїе твоѐ: да бꙋ́детъ во́лѧ твоѧ̀, ꙗ҆́кѡ на нб҃сѝ и҆ на землѝ. Хлѣ́бъ на́шъ насꙋ́щный да́ждь на́мъ дне́сь; и҆ ѡ҆ста́ви на́мъ до́лги на́шѧ, ꙗ҆́коже и҆ мы̀ ѡ҆ставлѧ́емъ должникѡ́мъ на́шымъ: и҆ не введѝ на́съ во и҆скꙋше́нїе, но и҆зба́ви на́съ ѿ лꙋка́вагѡ.', 'title' => 'Ѻ҆́ч҃е на́шъ'],
            'glory-now' => ['short' => 'Сла́ва, и҆ ны́нѣ:', 'full' => 'Сла́ва ѻ҆ц҃ꙋ̀, и҆ сн҃ꙋ, и҆ ст҃о́мꙋ дх҃ꙋ, и҆ ны́нѣ и҆ при́снѡ, и҆ во вѣ́ки вѣкѡ́въ. А҆ми́нь.', 'title' => 'Сла́ва, и҆ ны́нѣ'],
        ],
    ];
    $language = array_key_exists($language, $entries) ? $language : 'cu';
    $entry = $entries[$language][$id];
    return ['title' => $entry['title'], 'text' => $entry[$mode], 'source' => [[
        'title' => $language === 'cu' ? 'Ponomar: Часослов Московской Патриархии' : 'Азбука веры: Часослов',
        'url' => $language === 'cu' ? 'https://www.ponomar.net/' : 'https://azbyka.ru/bogosluzhenie/1/chasoslov/',
    ]]];
}

/** @return array<int, array<string,mixed>> */
function calendar_service_expansions(string $mode, string $language): array {
    $rows = [];
    foreach (['come-worship', 'trisagion', 'lords-prayer', 'glory-now'] as $id) {
        $entry = calendar_service_expansion($id, $mode, $language);
        $rows[] = ['id' => $id, 'mode' => $mode, 'language' => $language, 'title' => $entry['title'], 'text' => $entry['text'], 'source' => $entry['source']];
    }
    foreach ([3, 12, 40] as $count) {
        $rows[] = ['id' => 'lord-have-mercy-' . $count, 'title' => 'Господи, помилуй (' . $count . ')', 'mode' => $mode, 'language' => $language,
            // A count is a rubric; do not manufacture forty printed repetitions.
            'text' => $language === 'cu' ? 'Гдⷭ҇и поми́лꙋй, ' . $count . '.' : 'Господи, помилуй. (' . $count . ' раз.)',
            'source' => [['title' => $language === 'cu' ? 'Ponomar: Часослов Московской Патриархии' : 'Азбука веры: Часослов', 'url' => $language === 'cu' ? 'https://www.ponomar.net/' : 'https://azbyka.ru/bogosluzhenie/1/chasoslov/']]];
    }
    return $rows;
}
/** @return array{pascha:string, daysFromPascha:int, period:string, label:string, tone:int|null} */
function calendar_service_movable_cycle(array $manifest, string $runtimeDirectory, string $date, string $profile, string $language, array $currentYear): array {
    $year = (int) substr($date, 0, 4);
    $nextPascha = (string) $currentYear['pascha'];
    // The public API starts in 1900. At its lower boundary keep the current
    // Pascha context instead of attempting to calculate the unavailable 1899.
    $liturgicalYear = $date >= $nextPascha || $year === 1900
        ? $currentYear
        : calendar_public_year($manifest, $runtimeDirectory, $year - 1, $profile, $language);
    $pascha = (string) $liturgicalYear['pascha'];
    $offset = calendar_service_days_between($pascha, $date);
    $untilPascha = calendar_service_days_between($date, $nextPascha);
    [$period, $label] = match (true) {
        $offset >= 0 && $offset <= 6 => ['bright-week', 'Светлая седмица'],
        $offset >= 7 && $offset <= 48 => ['paschal-period', 'Пасхальный период'],
        $offset === 49 => ['pentecost', 'Пятидесятница'],
        $offset >= 50 && $offset <= 55 => ['afterfeast-pentecost', 'Попразднство Пятидесятницы'],
        $offset >= 56 => ['after-pentecost', 'Период по Пятидесятнице'],
        $untilPascha >= 1 && $untilPascha <= 7 => ['holy-week', 'Страстная седмица'],
        $untilPascha >= 8 && $untilPascha <= 48 => ['great-lent', 'Великий пост'],
        $untilPascha >= 49 && $untilPascha <= 70 => ['triodion', 'Подготовительные седмицы Триоди'],
        default => ['ordinary', 'Обычный период'],
    };
    $weekday = (int) (new DateTimeImmutable($date, new DateTimeZone('UTC')))->format('w');
    $serviceSunday = (new DateTimeImmutable($date, new DateTimeZone('UTC')))->modify('-' . $weekday . ' days');
    $firstToneSunday = (new DateTimeImmutable($pascha, new DateTimeZone('UTC')))->modify('+56 days');
    $tone = $serviceSunday >= $firstToneSunday
        ? (int) ((intdiv(calendar_service_days_between($firstToneSunday->format('Y-m-d'), $serviceSunday->format('Y-m-d')), 7) % 8) + 1)
        : null;
    return ['pascha' => $pascha, 'daysFromPascha' => $offset, 'period' => $period, 'label' => $label, 'tone' => $tone];
}

/** @return array<int, array<string,mixed>> */
function calendar_service_assignments(array $library, int $weekday, ?int $tone, string $subject, bool $full = false): array {
    $texts = $library['texts'] ?? [];
    $selected = array_values(array_filter($texts, static function ($text) use ($weekday, $tone): bool {
        if (!is_array($text)) return false;
        if (!in_array($text['type'] ?? '', ['troparion', 'kontakion'], true)) return false;
        if ($weekday === 0) return ($text['scope'] ?? '') === 'resurrection' && ($text['tone'] ?? null) === $tone;
        // The reviewed corpus already binds texts to weekdays. A single subject
        // drops Nicholas on Thursdays and the departed on Saturdays; the old
        // closure also failed to capture $subject, dropping every weekday text.
        return ($text['scope'] ?? '') === 'weekday' && in_array($weekday, $text['weekdays'] ?? [], true);
    }));
    return array_map(static function (array $text) use ($weekday, $tone): array {
        return [
            'slot' => $text['type'] === 'troparion' ? 'troparion-of-day' : ($text['type'] === 'kontakion' ? 'kontakion-of-day' : $text['type'].'-reference'),
            'textId' => $text['id'], 'title' => $text['title'], 'text' => $text['text'],
            'language' => $text['language'], 'orthography' => $text['orthography'],
            'subject' => $text['subject'] ?? null,
            'sources' => $text['sources'],
            'reason' => in_array($text['type'], ['prayer','magnification'], true) ? 'Полный справочник Часослова' : ($weekday === 0 ? 'Воскресный глас ' . $tone : 'Текст дня седмицы'),
        ];
    }, $selected);
}

/**
 * Rendering data for readers. The API owns wording and rubric classification;
 * clients may only position the returned pieces in their local edition.
 *
 * @return array{rubricPrefixes:array<int,string>,inlineRubrics:array<int,string>,transforms:array<int,array<string,mixed>>,hiddenWhenShort:array<int,string>}
 */
function calendar_service_reader_rules(string $language, string $mode): array {
    $common = [
        'ru' => [
            'rubricPrefixes' => ['Стих ', 'Священник:', 'Чтец:', 'Если же ', 'Кондак праздника.', 'Богородичен'],
            'inlineRubrics' => ['И три поклона.'],
            'theotokion' => ['match' => 'И ныне, Богородичен:', 'full' => "И ныне и всегда, и во веки веков. Аминь.\nБогородичен:"],
        ],
        'cu-civil' => [
            'rubricPrefixes' => ['И аще ', 'Стих ', 'Слава, и ныне, Богородичен:', 'Трисвятое.', 'Кондак дне', 'Аще пост', 'Слава:', 'И ныне:'],
            'inlineRubrics' => ['Поклоны три.'],
            'theotokion' => ['match' => 'Слава, и ныне, Богородичен:', 'full' => "Слава Отцу и Сыну и Святому Духу, и ныне и присно и во веки веков. Аминь.\nБогородичен:"],
        ],
        'cu' => [
            'rubricPrefixes' => ['И҆ а҆́ще ', 'Сті́хъ ', 'Сла́ва, и҆ ны́нѣ, бг҃оро́диченъ:', 'Трист҃о́е.', 'Конда́къ днѐ', 'А҆́ще по́стъ', 'Сла́ва:', 'И҆ ны́нѣ:'],
            'inlineRubrics' => ['Покло́ны трѝ.'],
            'theotokion' => ['match' => 'Сла́ва, и҆ ны́нѣ, бг҃оро́диченъ:', 'full' => "Сла́ва ѻ҆ц҃ꙋ̀, и҆ сн҃ꙋ, и҆ ст҃о́мꙋ дх҃ꙋ, и҆ ны́нѣ и҆ при́снѡ, и҆ во вѣ́ки вѣкѡ́въ. А҆ми́нь.\nБг҃оро́диченъ:"],
        ],
    ];
    $set = $common[$language] ?? $common['cu'];
    $transforms = [];
    if ($mode === 'full') {
        $expansion = calendar_service_expansion('come-worship', 'full', $language);
        $short = calendar_service_expansion('come-worship', 'short', $language);
        $transforms[] = ['id' => 'come-worship', 'match' => $short['text'], 'text' => $expansion['text'], 'source' => $expansion['source']];
        $transforms[] = ['id' => 'glory-now-theotokion', 'match' => $set['theotokion']['match'], 'text' => $set['theotokion']['full'], 'source' => [[
            'title' => $language === 'cu' ? 'Ponomar: Часослов Московской Патриархии' : 'Азбука веры: Часослов',
            'url' => $language === 'cu' ? 'https://www.ponomar.net/' : 'https://azbyka.ru/bogosluzhenie/1/chasoslov/',
        ]]];
    }
    // The civic source already carries the three invocations as separate blocks.
    // In the short view only its last block remains as the canonical short rubric.
    $hiddenWhenShort = $language === 'cu-civil' && $mode === 'short'
        ? ['Прииди́те, поклони́мся Царе́ви на́шему Бо́гу.', 'Прииди́те, поклони́мся и припаде́м Христу́, Царе́ви на́шему Бо́гу.']
        : [];
    if ($language === 'cu-civil' && $mode === 'short') {
        $transforms[] = [
            'id' => 'come-worship-short',
            'match' => 'Прииди́те, поклони́мся и припаде́м Самому́ Христу́, Царе́ви и Бо́гу на́шему. Покло́ны три́.',
            'text' => calendar_service_expansion('come-worship', 'short', $language)['text'],
            'source' => [[ 'title' => 'Азбука веры: Часослов', 'url' => 'https://azbyka.ru/bogosluzhenie/1/chasoslov/' ]],
        ];
    }
    return ['rubricPrefixes' => $set['rubricPrefixes'], 'inlineRubrics' => $set['inlineRubrics'], 'transforms' => $transforms, 'hiddenWhenShort' => $hiddenWhenShort];
}
function calendar_service_routes(string $method, string $path): void {
    $demo = in_array($path, ['/v1/calendar-demo/service', '/v1/calendar-demo/service/'], true);
    if (!$demo && !in_array($path, ['/v1/calendar/service', '/v1/calendar/service/'], true)) return;
    if ($demo) {
        header('Cache-Control: private, no-store');
        header('Allow: POST');
        if ($method !== 'POST') calendar_fail('method_not_allowed', 405);
        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $configuredOrigin = rtrim(calendar_config_value('APP_PUBLIC_URL', $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? '')), '/');
        $aliases = ['https://kalender.georg-kloster.ru', 'https://kalender.georg-kloster.de'];
        $allowedOrigins = in_array($configuredOrigin, $aliases, true) ? $aliases : [$configuredOrigin];
        $origin = api_header('Origin');
        $referer = api_header('Referer');
        if ($origin === '' || !in_array($origin, $allowedOrigins, true)
            || api_header('Sec-Fetch-Site') !== 'same-origin'
            || api_header('X-Calendar-Demo') !== '1'
            || !in_array(strtok($referer, '?'), [$origin . '/web-calendar', $origin . '/web-calendar/', $origin . '/web-calendar.html'], true)) {
            calendar_fail('demo_page_required', 403, 'Откройте страницу календаря на сайте Календарной мастерской.');
        }
        $method = 'GET';
    }
    if (!$demo) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
        header('Access-Control-Allow-Headers: Accept, X-API-Key, Authorization, If-None-Match');
        header('Access-Control-Expose-Headers: ETag, Retry-After, X-API-Month-Limit, X-API-Month-Remaining');
        if ($method === 'OPTIONS') { http_response_code(204); exit; }
        if (!in_array($method, ['GET', 'HEAD'], true)) calendar_fail('method_not_allowed', 405);
    }
    $allowed = ['date', 'office', 'lang', 'profile', 'expansion'];
    foreach ($_GET as $key => $value) if (!in_array($key, $allowed, true) || !is_string($value) || strlen($value) > 40) calendar_fail('invalid_parameter', 400);
    $date = calendar_public_parameter('date');
    $office = calendar_public_parameter('office', 'sixth-hour');
    $language = calendar_public_parameter('lang', 'cu');
    $profile = calendar_public_parameter('profile', 'typikon-strict');
    $expansion = calendar_public_parameter('expansion', 'short');
    if (!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/', $date) || !checkdate((int) substr($date, 5, 2), (int) substr($date, 8, 2), (int) substr($date, 0, 4))) calendar_fail('invalid_date', 400);
    if ((int) substr($date, 0, 4) < 1900 || (int) substr($date, 0, 4) > 2200) calendar_fail('invalid_year', 400);
    if (!in_array($office, ['horologion', 'midnight-office', 'matins', 'first-hour', 'third-hour', 'sixth-hour', 'ninth-hour', 'vespers', 'compline', 'typica'], true)
        || !in_array($language, ['ru', 'cu', 'cu-civil', 'de', 'uk', 'pl'], true)
        || !in_array($profile, ['typikon-strict', 'parish'], true)
        || !in_array($expansion, ['short', 'full'], true)) calendar_fail('invalid_parameter', 400);
    if (!$demo) {
        $key = api_header('X-API-Key'); if ($key === '') $key = api_bearer_token();
        $access = (new CalendarApiAccessStore())->authorize($key);
        if ($access['monthLimit'] !== null) { header('X-API-Month-Limit: ' . $access['monthLimit']); header('X-API-Month-Remaining: ' . $access['monthRemaining']); }
    }
    $runtimeDirectory = is_file(__DIR__ . '/calendar-runtime.json') ? __DIR__ : calendar_project_root() . '/dist/api';
    $manifest = calendar_read_json_file($runtimeDirectory . '/calendar-runtime.json', null);
    if (!is_array($manifest) || !preg_match('/^[a-f0-9]{64}$/', $manifest['dataVersion'] ?? '')) calendar_fail('calendar_not_built', 503);
    $year = (int) substr($date, 0, 4);
    $calendar = calendar_public_year($manifest, $runtimeDirectory, $year, $profile, $language);
    $day = null; foreach ($calendar['days'] as $candidate) if (($candidate['date'] ?? null) === $date) { $day = $candidate; break; }
    if (!is_array($day)) calendar_fail('date_not_found', 404);
    // Calendar texts are currently verified in Church Slavonic. A Russian UI
    // must receive that available text rather than silently producing no inserts.
    $textLanguage = $language === 'ru' ? 'cu' : $language;
    $apiLibrary = calendar_bible_desktop_texts(['language' => $textLanguage]);
    $library = ['version' => 'bible-desktop', 'contentHash' => null, 'texts' => $apiLibrary['texts']];
    $movable = calendar_service_movable_cycle($manifest, $runtimeDirectory, $date, $profile, $language, $calendar);
    $weekday = (int) $day['weekday'];
    $subjects = ['Воскресение Христово', 'Небесные силы бесплотные', 'Святой Иоанн Предтеча', 'Честной Крест', 'Святые апостолы и святитель Николай', 'Честной Крест', 'Все святые и усопшие'];
    $subjectIds = ['resurrection', 'angels', 'forerunner', 'cross', 'apostles', 'cross', 'all-saints'];
    $subject = $weekday === 0 ? 'resurrection' : ($subjectIds[$weekday] ?? '');
    $assignments = calendar_service_assignments($library, $weekday, $movable['tone'], $subject, $office === 'horologion');
    $commemorations = array_values(array_map(static fn($event) => array_intersect_key($event, array_flip(['id', 'title', 'typeCode', 'typikonMark', 'category', 'localization'])), array_filter($day['events'], static fn($event) => ($event['category'] ?? null) === 'commemoration')));
    calendar_public_response([
        'schemaVersion' => 1, 'apiVersion' => '1.2.0', 'date' => $date, 'office' => $office,
        'language' => $language, 'textLanguage' => $textLanguage, 'profile' => $profile,
        'calendar' => ['oldStyleDate' => $day['oldStyleDate'], 'weekday' => $weekday, 'weekdayName' => $day['weekdayName'], 'fasting' => $day['fasting'], 'commemorations' => $commemorations],
        'cycles' => [
            'daily' => ['office' => $office, 'date' => $date],
            'weekly' => ['weekday' => $weekday, 'subject' => $subjects[$weekday], 'subjectId' => $subject],
            'movable' => $movable,
            'annual' => ['commemorations' => $commemorations, 'source' => 'calendar-events'],
        ],
        'assignments' => $assignments,
        'properAssignments' => [],
        'assignmentStatus' => $assignments ? 'weekly-cycle-only' : 'no-verified-text-for-date',
        'expansions' => calendar_service_expansions($expansion, $language),
        'readerRules' => calendar_service_reader_rules($language, $expansion),
        'coverage' => [
            'weekly' => 'Воскресные гласы и дни седмицы из опубликованного корпуса.',
            'annual' => 'Памяти и праздники дня возвращаются полностью; собственные минейные тропари и кондаки не выдаются без проверенной привязки текста к конкретному событию.',
            'movable' => 'Период и глас рассчитываются из даты Пасхи; особые уставные замены выдаются по мере внесения в правило службы.',
            'office' => 'Полный текст последования хранится у читателя; API задаёт календарные вставки и развёртки сокращений.',
        ],
        'libraryVersion' => $library['version'] ?? null, 'libraryContentHash' => $library['contentHash'] ?? null,
    ], $method);
}
