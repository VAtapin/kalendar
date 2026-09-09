<?php
declare(strict_types=1);

/** Kalendar is a client of the Bible Desktop liturgical API. */
function calendar_bible_desktop_texts(array $query = []): array {
    $base = rtrim(calendar_config_value('BIBLE_DESKTOP_API_URL', 'https://bible-desktop.com/api'), '/');
    $key = calendar_config_value('BIBLE_DESKTOP_API_KEY');
    $url = $base.'/liturgical/calendar-texts'.($query ? '?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986) : '');
    $headers = ['Accept: application/json'];
    if ($key !== '') $headers[] = 'X-API-Key: '.$key;
    $context = stream_context_create(['http'=>['method'=>'GET','timeout'=>15,'ignore_errors'=>true,'header'=>implode("\r\n", $headers)], 'https'=>['method'=>'GET','timeout'=>15,'ignore_errors'=>true,'header'=>implode("\r\n", $headers)]]);
    $body = @file_get_contents($url, false, $context);
    $payload = is_string($body) ? json_decode($body, true) : null;
    if (!is_array($payload) || !is_array($payload['texts'] ?? null)) calendar_fail('bible_desktop_liturgical_unavailable', 503, 'Богослужебные тексты Bible Desktop временно недоступны.');
    return $payload;
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
