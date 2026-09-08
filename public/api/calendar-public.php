<?php
declare(strict_types=1);

/** Read-only public calendar API. Never exposes account or project storage. */
function calendar_public_response(array $body, string $method, bool $cache = true): never {
    $json = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    // Every request must pass key and quota checks; shared caches cannot bypass them.
    header('Cache-Control: private, no-store');
    $etag = '"' . hash('sha256', $json) . '"';
    header('ETag: ' . $etag);
    if (in_array($etag, array_map('trim', explode(',', $_SERVER['HTTP_IF_NONE_MATCH'] ?? '')), true)) {
        http_response_code(304); exit;
    }
    if ($method !== 'HEAD') echo $json;
    exit;
}

function calendar_public_parameter(string $key, string $default = ''): string {
    $value = $_GET[$key] ?? $default;
    if (!is_string($value) || strlen($value) > 40) calendar_fail('invalid_parameter', 400, 'Invalid parameter: ' . $key);
    return $value;
}

function calendar_public_runtime_version(string $directory): string {
    $hash = hash_init('sha256');
    foreach ([$directory . '/calendar-runtime.mjs', dirname($directory) . '/data/MemoryDays.xml', dirname($directory) . '/data/church-slavonic/catalogue.json'] as $file) {
        if (!is_file($file) || !hash_update_file($hash, $file)) calendar_fail('calendar_not_built', 503);
    }
    return hash_final($hash);
}

function calendar_public_generate(string $runtime, string $node, int $year, string $profile, string $language): array {
    if (!is_callable('proc_open') || !is_file($node)) {
        calendar_fail('calendar_runtime_unavailable', 503, 'Node.js runtime is unavailable. Check server configuration.');
    }
    // An argument array bypasses the shell. All data arguments have been allowlisted.
    $process = proc_open([$node, '--max-old-space-size=256', $runtime, (string)$year, $profile, $language],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, dirname($runtime), null,
        ['bypass_shell' => true, 'suppress_errors' => true]);
    if (!is_resource($process)) calendar_fail('calendar_runtime_unavailable', 503);
    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false); stream_set_blocking($pipes[2], false);
    $output = ''; $errors = ''; $deadline = microtime(true) + 20; $exitCode = -1;
    try {
        do {
            $output .= stream_get_contents($pipes[1]);
            $errors .= stream_get_contents($pipes[2]);
            if (strlen($output) > 32 * 1024 * 1024 || strlen($errors) > 65536 || microtime(true) > $deadline) {
                proc_terminate($process, 9);
                calendar_fail('calendar_runtime_limit', 503, 'Calendar calculation exceeded its resource limit.');
            }
            $status = proc_get_status($process);
            if (!$status['running']) { $exitCode = $status['exitcode']; break; }
            usleep(10000);
        } while (true);
        $output .= stream_get_contents($pipes[1]); $errors .= stream_get_contents($pipes[2]);
    } finally {
        fclose($pipes[1]); fclose($pipes[2]); proc_close($process);
    }
    if ($exitCode !== 0) {
        error_log('Public calendar runtime: ' . $errors);
        calendar_fail('calendar_calculation_failed', 503, 'Calendar calculation failed; see the server error log.');
    }
    $value = json_decode($output, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($value) || ($value['year'] ?? null) !== $year || !is_array($value['days'] ?? null)) {
        calendar_fail('calendar_calculation_failed', 503);
    }
    return $value;
}

function calendar_public_year(array $manifest, string $runtimeDirectory, int $year, string $profile, string $language): array {
    $directory = calendar_config_value('CALENDAR_DATA_DIR', calendar_project_root() . '/storage') . '/public-calendar-cache';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) calendar_fail('calendar_cache_unavailable', 503);
    $file = $directory . '/' . $manifest['dataVersion'] . '-' . $year . '-' . $profile . '-' . $language . '.json';
    $cached = calendar_read_json_file($file, null);
    if (is_array($cached)) return $cached;
    // Limit cache misses to one calculator per server; other clients may retry.
    $lock = fopen($directory . '/generation.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        if ($lock) fclose($lock);
        header('Retry-After: 2'); calendar_fail('calendar_busy', 503, 'Calendar is being calculated. Retry in two seconds.');
    }
    try {
        $cached = calendar_read_json_file($file, null);
        if (is_array($cached)) return $cached;
        if (calendar_public_runtime_version($runtimeDirectory) !== $manifest['dataVersion']) {
            header('Retry-After: 2'); calendar_fail('calendar_updating', 503, 'Calendar files are being updated. Retry shortly.');
        }
        $value = calendar_public_generate($runtimeDirectory . '/calendar-runtime.mjs',
            calendar_config_value('CALENDAR_NODE_BINARY', (string)($manifest['nodeBinary'] ?? '')), $year, $profile, $language);
        if (calendar_public_runtime_version($runtimeDirectory) !== $manifest['dataVersion']) {
            header('Retry-After: 2'); calendar_fail('calendar_updating', 503, 'Calendar files changed during calculation. Retry shortly.');
        }
        $value['metadata']['dataVersion'] = $manifest['dataVersion'];
        calendar_atomic_json_write($file, $value);
        // Bounded, reproducible API cache only; no calendar/account data is removed.
        $files = array_values(array_filter(glob($directory . '/*.json') ?: [], static fn($entry) =>
            preg_match('/^[a-f0-9]{64}-[0-9]{4}-(typikon-strict|parish)-(ru|cu|de|uk|pl)\.json$/', basename($entry)) === 1));
        usort($files, static fn($a, $b) => filemtime($b) <=> filemtime($a));
        foreach (array_slice($files, 32) as $expired) if ($expired !== $file) unlink($expired);
        return $value;
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}

function calendar_public_routes(string $method, string $path): void {
    if ($path !== '/v1/calendar' && !str_starts_with($path, '/v1/calendar/')) return;
    // Public data only. Wildcard CORS also allows a standalone file:// test page.
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
    header('Access-Control-Allow-Headers: Accept, If-None-Match, X-API-Key, Authorization');
    header('Access-Control-Expose-Headers: ETag, Retry-After, X-API-Month-Limit, X-API-Month-Remaining');
    header('Allow: GET, HEAD, OPTIONS');
    if ($method === 'OPTIONS') { http_response_code(204); exit; }
    if (!in_array($method, ['GET', 'HEAD'], true)) calendar_fail('method_not_allowed', 405);
    $action = substr($path, strlen('/v1/calendar'));
    if (!in_array($action, ['', '/', '/today', '/day', '/month', '/year', '/pascha'], true)) calendar_fail('not_found', 404);
    $allowed = match ($action) {
        '', '/' => [], '/today' => ['lang', 'profile'], '/day' => ['date', 'lang', 'profile'],
        '/month' => ['year', 'month', 'lang', 'profile'], default => ['year', 'lang', 'profile'],
    };
    foreach (array_keys($_GET) as $parameter) {
        if (!in_array($parameter, $allowed, true)) calendar_fail('invalid_parameter', 400, 'Unexpected query parameter.');
    }
    $protected = !in_array($action, ['', '/', '/today'], true);
    $runtimeDirectory = is_file(__DIR__ . '/calendar-runtime.json') ? __DIR__ : calendar_project_root() . '/dist/api';
    $manifest = calendar_read_json_file($runtimeDirectory . '/calendar-runtime.json', null);
    if (!is_array($manifest) || !preg_match('/^[a-f0-9]{64}$/', $manifest['dataVersion'] ?? '')) {
        calendar_fail('calendar_not_built', 503, 'Run npm run build on the server to prepare the calendar API.');
    }
    if ($action === '' || $action === '/') calendar_public_response([
        'apiVersion' => '1.0.0', 'dataVersion' => $manifest['dataVersion'],
        'yearRange' => ['min' => 1900, 'max' => 2200], 'dateSystem' => 'Gregorian civil date; oldStyleDate is Julian',
        'languages' => ['ru', 'cu', 'de', 'uk', 'pl'], 'defaultLanguage' => 'ru',
        'profiles' => ['typikon-strict', 'parish'], 'defaultProfile' => 'typikon-strict',
        'authentication' => ['header' => 'X-API-Key', 'public' => ['/', '/today'], 'todayTimezone' => 'Europe/Berlin'],
        'endpoints' => ['today', 'day?date=2027-05-02', 'month?year=2027&month=5', 'year?year=2027', 'pascha?year=2027'],
        'optionalParameters' => ['lang', 'profile'], 'iconImagesAvailable' => false,
        'scope' => 'Public calendar data only; no private calendars, photos or project-specific events.',
    ], $method);
    $language = calendar_public_parameter('lang', 'ru'); $profile = calendar_public_parameter('profile', 'typikon-strict');
    if (!in_array($language, ['ru', 'cu', 'de', 'uk', 'pl'], true)) calendar_fail('invalid_language', 400);
    if (!in_array($profile, ['typikon-strict', 'parish'], true)) calendar_fail('invalid_profile', 400);
    $date = $action === '/today' ? (new DateTimeImmutable('now', new DateTimeZone('Europe/Berlin')))->format('Y-m-d') : calendar_public_parameter('date');
    if ($action === '/today') $action = '/day';
    $yearText = $action === '/day' ? substr($date, 0, 4) : calendar_public_parameter('year');
    if (!preg_match('/^[0-9]{4}$/', $yearText) || (int)$yearText < 1900 || (int)$yearText > 2200) calendar_fail('invalid_year', 400, 'Supported years: 1900–2200.');
    $year = (int)$yearText;
    if ($action === '/day' && (!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/', $date) || !checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), $year))) calendar_fail('invalid_date', 400);
    $month = calendar_public_parameter('month');
    if ($action === '/month' && (!preg_match('/^(0?[1-9]|1[0-2])$/', $month))) calendar_fail('invalid_month', 400);
    // Only valid requests consume quota; authorization precedes calculation.
    if ($protected) {
        $key = api_header('X-API-Key');
        if ($key === '') $key = api_bearer_token();
        $access = (new CalendarApiAccessStore())->authorize($key);
        header('X-API-Month-Limit: ' . $access['monthLimit']);
        header('X-API-Month-Remaining: ' . $access['monthRemaining']);
    }
    $value = calendar_public_year($manifest, $runtimeDirectory, $year, $profile, $language);
    if ($action === '/day') {
        foreach ($value['days'] as $day) if ($day['date'] === $date) calendar_public_response(['metadata' => $value['metadata'], 'day' => $day], $method);
        calendar_fail('date_not_found', 404);
    }
    if ($action === '/pascha') calendar_public_response(['metadata' => $value['metadata'], 'year' => $year, 'pascha' => $value['pascha']], $method);
    if ($action === '/month') {
        $value['month'] = (int)$month;
        $value['days'] = array_values(array_filter($value['days'], static fn($day) => (int)substr($day['date'], 5, 2) === (int)$month));
    }
    calendar_public_response($value, $method);
}
