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

/** Icons are selected through resolved memory IDs, never by a movable date's month/day. */
function calendar_bible_desktop_icons(string $date): array {
    if (!preg_match('/^\d{4}-(\d{2}-\d{2})$/', $date, $match)) return [];
    $payload = calendar_bible_desktop_get('/calendar/day', ['date'=>$date, 'lang'=>'ru']);
    if (!is_array($payload) || ($payload['data']['date'] ?? null) !== $date || !is_array($payload['data']['icons'] ?? null)) return [];
    return array_values(array_filter(array_map(static function ($entry): ?array {
        if (!is_array($entry) || !is_string($entry['title'] ?? null)) return null;
        $image = ['url'=>$entry['image_url'] ?? null, 'width'=>$entry['width'] ?? null, 'height'=>$entry['height'] ?? null, 'sha256'=>$entry['sha256'] ?? null];
        if (!is_array($image) || !is_string($image['url'] ?? null) || !preg_match('#^https://bible-desktop\.com/(?:storage/calendar-icons/[a-f0-9]{64}\.(?:gif|jpg|jpeg|png|webp)|api/calendar/icons/[0-9]+/images/[0-9]+)$#D', $image['url'])) return null;
        return ['eventId'=>'calendar-icon-'.$entry['id'], 'id'=>$entry['id'], 'title'=>$entry['title'], 'description'=>$entry['description'] ?? '', 'imageUrl'=>$image['url'],
            'width'=>$image['width'] ?? null, 'height'=>$image['height'] ?? null, 'sha256'=>$image['sha256'] ?? null];
    }, $payload['data']['icons'])));
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
