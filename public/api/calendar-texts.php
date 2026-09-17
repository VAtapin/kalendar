<?php
declare(strict_types=1);

/** Shared transport; each endpoint retains its own validation and failure policy. */
function calendar_bible_desktop_get(string $path, array $query = [], int $timeout = 15): ?array {
    $base = rtrim(calendar_config_value('BIBLE_DESKTOP_API_URL', 'https://bible-desktop.com/api'), '/');
    $key = calendar_config_value('BIBLE_DESKTOP_API_KEY');
    $headers = ['Accept: application/json'];
    if ($key !== '') $headers[] = 'X-API-Key: '.$key;
    $context = stream_context_create(['http'=>['method'=>'GET','timeout'=>$timeout,'ignore_errors'=>true,'header'=>implode("\r\n", $headers)]]);
    $url = $base.$path.($query ? '?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986) : '');
    $body = @file_get_contents($url, false, $context);
    $payload = is_string($body) ? json_decode($body, true) : null;
    return is_array($payload) ? $payload : null;
}

/** Kalendar is a client of the Bible Desktop liturgical API. */
function calendar_bible_desktop_texts(array $query = []): array {
    $payload = calendar_bible_desktop_get('/liturgical/calendar-texts', $query);
    if (!is_array($payload) || !is_array($payload['texts'] ?? null)) calendar_fail('bible_desktop_liturgical_unavailable', 503, 'Богослужебные тексты Bible Desktop временно недоступны.');
    return $payload;
}

/** Read the central Hour plan, including rubric selection and special office mode. */
function calendar_bible_desktop_service(array $query): array {
    $payload = calendar_bible_desktop_get('/calendar/service', $query, 20);
    $data = $payload['data'] ?? null;
    if (!is_array($data) || ($data['date'] ?? null) !== $query['date'] || ($data['office'] ?? null) !== $query['office']
        || ($data['textLanguage'] ?? null) !== $query['lang'] || ($data['profile'] ?? null) !== $query['profile'] || !is_array($data['assignments'] ?? null)) {
        calendar_fail('bible_desktop_service_unavailable',503,'План службы Bible Desktop временно недоступен.');
    }
    return $data;
}

/** Normalize names only for matching an icon to a resolved calendar event. */
function calendar_icon_match_tokens(string $value): array {
    $value = mb_strtolower(str_replace('ё', 'е', $value));
    $value = preg_replace('/\p{Mn}+/u', '', $value) ?? $value;
    $value = preg_replace('/\b(?:икона|иконы|икон|божией|божия|богородицы|богородица|богоматери|матери|святитель|святителя|преподобный|преподобная|мученик|мученица|священномученик|сщмч|прмч|епископ|еп|архимандрит|и|в|на|о|с|имени|именуемой)\b/iu', ' ', $value) ?? $value;
    $tokens = preg_split('/[^\p{L}]+/u', $value) ?: [];
    $tokens = array_map(static fn(string $token): string => mb_substr($token, 0, 7), $tokens);
    return array_values(array_unique(array_filter($tokens, static fn(string $token): bool => mb_strlen($token) >= 4)));
}

function calendar_icon_common_token_count(array $left, array $right): int {
    $matches = [];
    foreach ($left as $leftToken) foreach ($right as $rightToken) {
        $length = min(mb_strlen($leftToken), mb_strlen($rightToken));
        if ($length >= 5 && mb_substr($leftToken, 0, $length) === mb_substr($rightToken, 0, $length)) $matches[] = mb_substr($leftToken, 0, $length);
    }
    return count(array_unique($matches));
}

/** The published icon date labels remain Bible Desktop source data. */
function calendar_icon_dates(mixed $dates): array {
    if (!is_array($dates)) return [];
    $result = [];
    foreach ($dates as $entry) {
        if (!is_array($entry) || !is_string($entry['label'] ?? null) || trim($entry['label']) === '') continue;
        $result[] = [
            'label' => trim($entry['label']),
            'exampleGregorianDate' => is_string($entry['exampleGregorianDate'] ?? null) ? $entry['exampleGregorianDate'] : null,
            'monthDay' => is_string($entry['monthDay'] ?? null) && preg_match('/^\d{2}-\d{2}$/', $entry['monthDay']) ? $entry['monthDay'] : null,
            'movable' => is_bool($entry['movable'] ?? null) ? $entry['movable'] : null,
            'status' => is_string($entry['status'] ?? null) ? $entry['status'] : null,
        ];
    }
    return $result;
}

/**
 * A date catalogue has no foreign key to a calendar event.  Match only when
 * two meaningful normalized name fragments agree, never by the raw catalogue
 * order or a single generic word.  A source date label after its dash is also
 * a valid, separately reported relation (for example a regional Sobor).
 */
function calendar_icon_event_match(array $icon, array $event, string $date): ?array {
    if (($event['category'] ?? '') !== 'commemoration' || !is_string($event['title'] ?? null)) return null;
    $eventTokens = calendar_icon_match_tokens($event['title']);
    if (!$eventTokens) return null;
    $titleTokens = calendar_icon_match_tokens((string)($icon['title'] ?? ''));
    $titleMatches = calendar_icon_common_token_count($titleTokens, $eventTokens);
    if ($titleMatches >= 2) return ['score' => 200 + $titleMatches, 'kind' => 'title'];
    foreach (($icon['dates'] ?? []) as $observance) {
        if (!is_array($observance)) continue;
        $isDate = ($observance['exampleGregorianDate'] ?? null) === $date || ($observance['monthDay'] ?? null) === substr($date, 5);
        if (!$isDate || !is_string($observance['label'] ?? null)) continue;
        $label = preg_replace('/^.*?\s[-—]\s*/u', '', $observance['label']) ?? $observance['label'];
        $matches = calendar_icon_common_token_count(calendar_icon_match_tokens($label), $eventTokens);
        if ($matches >= 2) return ['score' => 100 + $matches, 'kind' => 'observance'];
    }
    return null;
}

function calendar_icon_image_area(array $image): int {
    $width = is_int($image['width'] ?? null) ? $image['width'] : 0;
    $height = is_int($image['height'] ?? null) ? $image['height'] : 0;
    return $width > 0 && $height > 0 ? $width * $height : 0;
}

/**
 * Read the complete icon catalogue for the calendar month/day and enrich it
 * with the resolved event rank from MemoryDays. Bible Desktop supplies the
 * cards, images and published observance labels; Kalendar supplies only the
 * explicit, auditable event relation and ordering.
 */
function calendar_bible_desktop_icons(string $date, array $events = []): array {
    if (!preg_match('/^\d{4}-(\d{2}-\d{2})$/', $date, $match)) return [];
    $payload = calendar_bible_desktop_get('/calendar/icons', ['month_day'=>$match[1], 'with_images'=>'1', 'per_page'=>'100']);
    if (!is_array($payload) || !is_array($payload['data'] ?? null)) return [];
    $icons = array_values(array_filter(array_map(static function ($entry): ?array {
        if (!is_array($entry) || !is_string($entry['title'] ?? null) || !is_array($entry['images'] ?? null)) return null;
        $images = array_values(array_filter(array_map(static function ($image): ?array {
            if (!is_array($image) || !is_string($image['url'] ?? null)
                || !preg_match('#^https://bible-desktop\.com/(?:storage/calendar-icons/[a-f0-9]{64}\.(?:gif|jpg|jpeg|png|webp)|api/calendar/icons/[0-9]+/images/[0-9]+)$#D', $image['url'])) return null;
            return ['url'=>$image['url'], 'width'=>$image['width'] ?? null, 'height'=>$image['height'] ?? null, 'sha256'=>$image['sha256'] ?? null];
        }, $entry['images'])));
        if (!$images) return null;
        usort($images, static fn(array $left, array $right): int => calendar_icon_image_area($right) <=> calendar_icon_image_area($left));
        $first = $images[0];
        return ['eventId'=>'calendar-icon-'.$entry['id'], 'id'=>$entry['id'], 'title'=>$entry['title'], 'kind'=>$entry['kind'] ?? null,
            'description'=>$entry['description'] ?? '', 'imageUrl'=>$first['url'], 'width'=>$first['width'] ?? null, 'height'=>$first['height'] ?? null,
            'sha256'=>$first['sha256'] ?? null, 'images'=>$images, 'dates'=>calendar_icon_dates($entry['dates'] ?? [])];
    }, $payload['data'])));
    $ranked = [];
    foreach ($icons as $index => $icon) {
        $kindOrder = match ($icon['kind'] ?? null) { 'savior' => 0, 'mother-of-god' => 1, default => 2 };
        $best = null;
        foreach ($events as $event) {
            if (!is_array($event)) continue;
            $match = calendar_icon_event_match($icon, $event, $date);
            if ($match === null) continue;
            $candidate = [
                'eventId' => is_string($event['id'] ?? null) ? $event['id'] : null,
                'typeCode' => is_int($event['typeCode'] ?? null) ? $event['typeCode'] : null,
                'priority' => is_int($event['priority'] ?? null) ? $event['priority'] : null,
                'typikonMark' => is_array($event['typikonMark'] ?? null) ? $event['typikonMark'] : null,
                'match' => $match['kind'],
                'score' => $match['score'],
            ];
            if ($best === null || $candidate['score'] > $best['score'] || ($candidate['score'] === $best['score'] && ($candidate['priority'] ?? 0) > ($best['priority'] ?? 0))) $best = $candidate;
        }
        $icon['calendarRank'] = $best;
        $ranked[] = ['icon' => $icon, 'order' => [$kindOrder, $best === null ? 1 : 0, $best === null ? 0 : -($best['priority'] ?? 0), $best === null ? 0 : -$best['score'], $index]];
    }
    usort($ranked, static fn(array $left, array $right): int => $left['order'] <=> $right['order']);
    return array_values(array_map(static fn(array $entry): array => $entry['icon'], $ranked));
}

/** Reference texts are proxied only for calendar clients during the cutover. */
function calendar_texts_routes(string $method,string $path): void {
    if(!in_array($path,['/v1/calendar-texts','/v1/calendar-texts/'],true))return;
    header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
    header('Access-Control-Allow-Headers: Accept, X-API-Key, Authorization, If-None-Match');
    if($method==='OPTIONS'){http_response_code(204);exit;}
    if(!in_array($method,['GET','HEAD'],true))calendar_fail('method_not_allowed',405);
    $allowed=['id','type','scope','tone','weekday','language'];
    foreach($_GET as $key=>$value)if(!in_array($key,$allowed,true)||!is_string($value)||strlen($value)>100)calendar_fail('invalid_parameter',400);
    $key=api_header('X-API-Key');if($key==='')$key=api_bearer_token();
    $access=(new CalendarApiAccessStore())->authorize($key);
    if($access['monthLimit']!==null){header('X-API-Month-Limit: '.$access['monthLimit']);header('X-API-Month-Remaining: '.$access['monthRemaining']);}
    $payload = calendar_bible_desktop_texts($_GET);
    calendar_public_response(['schemaVersion'=>2,'source'=>'bible-desktop','count'=>count($payload['texts']),'texts'=>$payload['texts']],$method);
}
