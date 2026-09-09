<?php
declare(strict_types=1);

/** The single API source for Horologion, canons, akathists and appendices. */
function calendar_liturgical_routes(string $method, string $path): void {
    if (!str_starts_with($path, '/v1/liturgical')) return;
    if (!in_array($method, ['GET', 'HEAD'], true)) calendar_fail('method_not_allowed', 405);
    $key = api_header('X-API-Key'); if ($key === '') $key = api_bearer_token();
    (new CalendarApiAccessStore())->authorize($key);
    $library = calendar_read_json_file(dirname(__DIR__).'/data/liturgical-corpus.json', null);
    if (!is_array($library) || !is_array($library['works'] ?? null)) calendar_fail('liturgical_library_unavailable', 503);
    $works = array_values(array_filter($library['works'], static fn($work) => is_array($work) && is_string($work['slug'] ?? null) && is_array($work['versions'] ?? null)));
    if (in_array($path, ['/v1/liturgical', '/v1/liturgical/collections'], true)) {
        $collections = ['canons'=>'Каноны','akathists'=>'Акафисты','horologion'=>'Часослов','horologion-appendix'=>'Приложение к Часослову'];
        $data = array_map(static fn($id,$title) => ['id'=>$id,'title'=>$title,'count'=>count(array_filter($works, static fn($work) => in_array($id, $work['collections'] ?? [], true)))], array_keys($collections), $collections);
        calendar_public_response(['schemaVersion'=>1,'version'=>$library['version'] ?? null,'data'=>$data], $method);
    }
    if ($path === '/v1/liturgical/works') {
        $collection = $_GET['collection'] ?? null; if ($collection !== null && (!is_string($collection) || !preg_match('/^[a-z-]{1,40}$/', $collection))) calendar_fail('invalid_parameter',400);
        $data = array_values(array_map(static fn($work) => ['slug'=>$work['slug'],'title'=>$work['title'] ?? $work['slug'],'collections'=>$work['collections'] ?? [],'available_languages'=>array_keys($work['versions']),'source_url'=>$work['url'] ?? null], array_filter($works, static fn($work) => $collection === null || in_array($collection, $work['collections'] ?? [], true))));
        calendar_public_response(['schemaVersion'=>1,'version'=>$library['version'] ?? null,'data'=>$data], $method);
    }
    if (preg_match('#^/v1/liturgical/works/([a-z0-9-]+)$#', $path, $match) === 1) {
        foreach ($works as $work) if ($work['slug'] === $match[1]) {
            calendar_public_response(['schemaVersion'=>1,'version'=>$library['version'] ?? null,'data'=>['slug'=>$work['slug'],'title'=>$work['title'] ?? $work['slug'],'collections'=>$work['collections'] ?? [],'available_languages'=>array_keys($work['versions']),'source_url'=>$work['url'] ?? null]], $method);
        }
        calendar_fail('liturgical_work_not_found',404);
    }
    if (preg_match('#^/v1/liturgical/works/([a-z0-9-]+)/versions/([a-z-]{2,20})$#', $path, $match) === 1) {
        foreach ($works as $work) if ($work['slug'] === $match[1] && isset($work['versions'][$match[2]])) {
            $blocks=$work['versions'][$match[2]];
            calendar_public_response(['schemaVersion'=>1,'version'=>$library['version'] ?? null,'data'=>['slug'=>$work['slug'],'title'=>$work['title'] ?? $work['slug'],'language'=>$match[2],'orthography'=>'source-html','blocks'=>$blocks,'credit'=>$work['credits'][$match[2]] ?? null,'source_url'=>$work['url'] ?? null,'content_hash'=>hash('sha256',json_encode($blocks,JSON_UNESCAPED_UNICODE))]], $method);
        }
        calendar_fail('liturgical_work_not_found',404);
    }
    calendar_fail('not_found',404);
}
