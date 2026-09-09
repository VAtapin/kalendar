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
function calendar_service_expansion(string $id, string $mode): array {
    $entries = [
        'come-worship' => [
            'short' => 'Приидите, поклонимся: трижды.',
            'full' => "Приидите, поклонимся Цареви нашему Богу.\nПриидите, поклонимся и припадем Христу, Цареви нашему Богу.\nПриидите, поклонимся и припадем Самому Христу, Цареви и Богу нашему.",
            'title' => 'Приидите, поклонимся',
        ],
        'trisagion' => [
            'short' => 'Трисвятое.',
            'full' => "Святый Боже, Святый Крепкий, Святый Безсмертный, помилуй нас. (Трижды.)\nСлава Отцу и Сыну и Святому Духу, и ныне и присно и во веки веков. Аминь.\nПресвятая Троице, помилуй нас; Господи, очисти грехи наша; Владыко, прости беззакония наша; Святый, посети и исцели немощи наша, имене Твоего ради.\nГосподи, помилуй. (Трижды.)\nСлава Отцу и Сыну и Святому Духу, и ныне и присно и во веки веков. Аминь.",
            'title' => 'Трисвятое',
        ],
        'lords-prayer' => [
            'short' => 'По Отче наш:',
            'full' => 'Отче наш, Иже еси на Небесех, да святится имя Твое, да приидет Царствие Твое, да будет воля Твоя, яко на Небеси и на земли. Хлеб наш насущный даждь нам днесь; и остави нам долги наша, якоже и мы оставляем должником нашим; и не введи нас во искушение, но избави нас от лукаваго.',
            'title' => 'Отче наш',
        ],
        'glory-now' => [
            'short' => 'Слава, и ныне:',
            'full' => 'Слава Отцу и Сыну и Святому Духу, и ныне и присно и во веки веков. Аминь.',
            'title' => 'Слава, и ныне',
        ],
    ];
    $entry = $entries[$id];
    return ['title' => $entry['title'], 'text' => $entry[$mode], 'source' => [[
        'title' => 'Часослов: общеупотребительные молитвы',
        'url' => 'https://azbyka.ru/bogosluzhenie/1/chasoslov/',
    ]]];
}

/** @return array<int, array<string,mixed>> */
function calendar_service_expansions(string $mode): array {
    $rows = [];
    foreach (['come-worship', 'trisagion', 'lords-prayer', 'glory-now'] as $id) {
        $entry = calendar_service_expansion($id, $mode);
        $rows[] = ['id' => $id, 'mode' => $mode, 'title' => $entry['title'], 'text' => $entry['text'], 'source' => $entry['source']];
    }
    foreach ([3, 12, 40] as $count) {
        $rows[] = [
            'id' => 'lord-have-mercy-' . $count,
            'title' => 'Господи, помилуй (' . $count . ')',
            'mode' => $mode,
            'text' => $mode === 'full' ? implode("\n", array_fill(0, $count, 'Господи, помилуй.')) : 'Господи, помилуй, ' . $count . '.',
            'source' => [['title' => 'Часослов: общеупотребительные молитвы', 'url' => 'https://azbyka.ru/bogosluzhenie/1/chasoslov/']],
        ];
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
function calendar_service_assignments(array $library, int $weekday, ?int $tone, bool $full = false): array {
    $texts = $library['texts'] ?? [];
    $selected = array_values(array_filter($texts, static function ($text) use ($weekday, $tone, $full): bool {
        if (!is_array($text)) return false;
        if ($full && in_array($text['type'] ?? '', ['prayer', 'magnification'], true)) return true;
        if (!in_array($text['type'] ?? '', ['troparion', 'kontakion'], true)) return false;
        if ($weekday === 0) return ($text['scope'] ?? '') === 'resurrection' && ($text['tone'] ?? null) === $tone;
        return ($text['scope'] ?? '') === 'weekday' && in_array($weekday, $text['weekdays'] ?? [], true);
    }));
    return array_map(static function (array $text) use ($weekday, $tone): array {
        return [
            'slot' => $text['type'] === 'troparion' ? 'troparion-of-day' : ($text['type'] === 'kontakion' ? 'kontakion-of-day' : $text['type'].'-reference'),
            'textId' => $text['id'], 'title' => $text['title'], 'text' => $text['text'],
            'language' => $text['language'], 'orthography' => $text['orthography'],
            'sources' => $text['sources'],
            'reason' => in_array($text['type'], ['prayer','magnification'], true) ? 'Полный справочник Часослова' : ($weekday === 0 ? 'Воскресный глас ' . $tone : 'Текст дня седмицы'),
        ];
    }, $selected);
}

function calendar_service_routes(string $method, string $path): void {
    if (!in_array($path, ['/v1/calendar/service', '/v1/calendar/service/'], true)) return;
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
    header('Access-Control-Allow-Headers: Accept, X-API-Key, Authorization, If-None-Match');
    header('Access-Control-Expose-Headers: ETag, Retry-After, X-API-Month-Limit, X-API-Month-Remaining');
    if ($method === 'OPTIONS') { http_response_code(204); exit; }
    if (!in_array($method, ['GET', 'HEAD'], true)) calendar_fail('method_not_allowed', 405);
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
        || !in_array($language, ['ru', 'cu', 'de', 'uk', 'pl'], true)
        || !in_array($profile, ['typikon-strict', 'parish'], true)
        || !in_array($expansion, ['short', 'full'], true)) calendar_fail('invalid_parameter', 400);
    $key = api_header('X-API-Key'); if ($key === '') $key = api_bearer_token();
    $access = (new CalendarApiAccessStore())->authorize($key);
    if ($access['monthLimit'] !== null) { header('X-API-Month-Limit: ' . $access['monthLimit']); header('X-API-Month-Remaining: ' . $access['monthRemaining']); }
    $runtimeDirectory = is_file(__DIR__ . '/calendar-runtime.json') ? __DIR__ : calendar_project_root() . '/dist/api';
    $manifest = calendar_read_json_file($runtimeDirectory . '/calendar-runtime.json', null);
    if (!is_array($manifest) || !preg_match('/^[a-f0-9]{64}$/', $manifest['dataVersion'] ?? '')) calendar_fail('calendar_not_built', 503);
    $year = (int) substr($date, 0, 4);
    $calendar = calendar_public_year($manifest, $runtimeDirectory, $year, $profile, $language);
    $day = null; foreach ($calendar['days'] as $candidate) if (($candidate['date'] ?? null) === $date) { $day = $candidate; break; }
    if (!is_array($day)) calendar_fail('date_not_found', 404);
    $library = calendar_read_json_file(dirname(__DIR__) . '/data/liturgical-texts.json', null);
    if (!is_array($library) || !is_array($library['texts'] ?? null)) calendar_fail('text_library_unavailable', 503);
    $movable = calendar_service_movable_cycle($manifest, $runtimeDirectory, $date, $profile, $language, $calendar);
    $weekday = (int) $day['weekday'];
    $subjects = ['Воскресение Христово', 'Небесные силы бесплотные', 'Святой Иоанн Предтеча', 'Честной Крест', 'Святые апостолы и святитель Николай', 'Честной Крест', 'Все святые и усопшие'];
    $assignments = calendar_service_assignments($library, $weekday, $movable['tone'], $office === 'horologion');
    $commemorations = array_values(array_map(static fn($event) => array_intersect_key($event, array_flip(['id', 'title', 'typeCode', 'typikonMark', 'category', 'localization'])), array_filter($day['events'], static fn($event) => ($event['category'] ?? null) === 'commemoration')));
    calendar_public_response([
        'schemaVersion' => 1, 'apiVersion' => '1.1.0', 'date' => $date, 'office' => $office,
        'language' => $language, 'textLanguage' => 'cu', 'profile' => $profile,
        'calendar' => ['oldStyleDate' => $day['oldStyleDate'], 'weekday' => $weekday, 'weekdayName' => $day['weekdayName'], 'fasting' => $day['fasting'], 'commemorations' => $commemorations],
        'cycles' => [
            'daily' => ['office' => $office, 'date' => $date],
            'weekly' => ['weekday' => $weekday, 'subject' => $subjects[$weekday]],
            'movable' => $movable,
            'annual' => ['commemorations' => $commemorations, 'source' => 'calendar-events'],
        ],
        'assignments' => $assignments,
        'expansions' => calendar_service_expansions($expansion),
        'coverage' => [
            'weekly' => 'Воскресные гласы и дни седмицы из опубликованного корпуса.',
            'annual' => 'Памяти и праздники дня возвращаются полностью; собственные минейные тропари и кондаки появляются после внесения проверенного текста для этой памяти.',
            'movable' => 'Период и глас рассчитываются из даты Пасхи; особые уставные замены выдаются по мере внесения в правило службы.',
            'office' => 'Полный текст последования хранится у читателя; API задаёт календарные вставки и развёртки сокращений.',
        ],
        'libraryVersion' => $library['version'] ?? null, 'libraryContentHash' => $library['contentHash'] ?? null,
    ], $method);
}
