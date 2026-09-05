<?php

declare(strict_types=1);

require_once __DIR__ . DIRECTORY_SEPARATOR . 'lib.php';

header_remove('X-Powered-By');

function api_response(int $status, mixed $body = null, bool $cache = false): never
{
    http_response_code($status);
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Cache-Control: ' . ($cache && $status === 200 ? 'public, max-age=3600' : 'no-store'));
    if ($status !== 204) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }
    exit;
}

function api_header(string $name): string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return trim((string) ($_SERVER[$key] ?? ''));
}

function api_bearer_token(): string
{
    $authorization = api_header('Authorization');
    return preg_match('/^Bearer\s+(.+)$/i', $authorization, $match) === 1 ? trim($match[1]) : '';
}

function api_request_body(int $maximumBytes): string
{
    $declared = filter_var($_SERVER['CONTENT_LENGTH'] ?? null, FILTER_VALIDATE_INT);
    if (is_int($declared) && $declared > $maximumBytes) {
        calendar_fail('payload_too_large', 413, 'Файл слишком большой');
    }
    $stream = fopen('php://input', 'rb');
    if ($stream === false) {
        calendar_fail('invalid_body', 400);
    }
    $body = stream_get_contents($stream, $maximumBytes + 1);
    fclose($stream);
    if ($body === false) {
        calendar_fail('invalid_body', 400);
    }
    if (strlen($body) > $maximumBytes) {
        calendar_fail('payload_too_large', 413, 'Файл слишком большой');
    }
    return $body;
}

/** @return array<string, mixed> */
function api_request_json(int $maximumBytes = 1048576): array
{
    try {
        $value = json_decode(api_request_body($maximumBytes), true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        calendar_fail('invalid_json', 400, 'Некорректные данные');
    }
    if (!is_array($value)) {
        calendar_fail('invalid_json', 400, 'Некорректные данные');
    }
    return $value;
}

function api_public_url(): string
{
    $configured = rtrim(calendar_config_value('APP_PUBLIC_URL'), '/');
    if ($configured !== '') {
        return $configured;
    }
    $origin = rtrim(api_header('Origin'), '/');
    if (preg_match('#^https?://#i', $origin) === 1) {
        return $origin;
    }
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? '127.0.0.1');
}

function api_client_address(): string
{
    $address = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if (in_array($address, ['127.0.0.1', '::1'], true)) {
        $forwarded = api_header('X-Forwarded-For');
        if ($forwarded !== '') {
            $address = trim(explode(',', $forwarded, 2)[0]);
        }
    }
    return calendar_text_slice($address !== '' ? $address : 'unknown', 80);
}

function api_valid_email(mixed $value): bool
{
    return is_string($value) && strlen($value) <= 254 && filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
}

function api_valid_project(mixed $value): bool
{
    if (!is_array($value) || ($value['schemaVersion'] ?? null) !== 1 || !is_string($value['name'] ?? null) || strlen($value['name']) > 200) {
        return false;
    }
    $pages = $value['document']['pages'] ?? null;
    return is_array($pages) && count($pages) > 0 && count($pages) <= 100;
}

function api_valid_grid_template(mixed $value): bool
{
    if (!is_array($value) || !is_string($value['name'] ?? null) || trim($value['name']) === '' || strlen($value['name']) > 160) {
        return false;
    }
    if (!is_string($value['description'] ?? null) || strlen($value['description']) > 600 || !is_array($value['grid'] ?? null)) {
        return false;
    }
    $grid = $value['grid'];
    return ($grid['type'] ?? null) === 'calendar-grid'
        && ($grid['columns'] ?? null) === 7
        && in_array($grid['weekRows'] ?? null, [4, 5, 6], true)
        && is_string($grid['weekdayLabelMode'] ?? null)
        && is_bool($grid['showWeekdayHeader'] ?? null)
        && is_string($grid['dayNumberFontFamily'] ?? null)
        && strlen($grid['dayNumberFontFamily']) <= 240
        && is_string($grid['eventFontFamily'] ?? null)
        && strlen($grid['eventFontFamily']) <= 240;
}

/** @return array{editorId: string, editorLabel: string}|null */
function api_editor(mixed $value): ?array
{
    if (!is_array($value) || !is_string($value['editorId'] ?? null)) {
        return null;
    }
    $editorId = $value['editorId'];
    if (strlen($editorId) < 8 || strlen($editorId) > 100) {
        return null;
    }
    $label = is_string($value['editorLabel'] ?? null) ? trim($value['editorLabel']) : '';
    return ['editorId' => $editorId, 'editorLabel' => $label !== '' ? calendar_text_slice($label, 80) : 'Другой редактор'];
}

/** @param array<string, mixed> $stored @param array<string, string> $lease @return array<string, mixed> */
function api_lease_response(array $stored, array $lease): array
{
    return [
        'status' => 'editing',
        'projectId' => $stored['id'],
        'project' => $stored['project'],
        'revision' => $stored['revision'],
        'leaseToken' => $lease['token'],
        'expiresAt' => $lease['expiresAt'],
    ];
}

/** @return array{id: string, email: string}|null */
function api_owner(CalendarStore $store): ?array
{
    $ownerEmail = strtolower(trim(calendar_config_value('CALENDAR_OWNER_EMAIL')));
    $credential = $store->credentialFor(api_bearer_token());
    return $ownerEmail !== '' && $credential !== null && strtolower($credential['email']) === $ownerEmail ? $credential : null;
}

/** @param array<string, mixed> $upload */
function api_serve_pdf(CalendarStore $store, array $upload): never
{
    if (!isset($upload['completedAt'])) {
        calendar_fail('export_not_found', 404, 'PDF не найден');
    }
    $file = $store->pdfExportFile($upload);
    $size = is_file($file) ? filesize($file) : false;
    if ($size === false) {
        calendar_fail('export_not_found', 404, 'PDF не найден');
    }

    $start = 0;
    $end = $size - 1;
    $status = 200;
    $range = api_header('Range');
    if ($range !== '') {
        if (preg_match('/^bytes=(\d*)-(\d*)$/', $range, $match) !== 1 || ($match[1] === '' && $match[2] === '')) {
            http_response_code(416);
            header('Content-Range: bytes */' . $size);
            exit;
        }
        if ($match[1] === '') {
            $suffix = min((int) $match[2], $size);
            $start = $size - $suffix;
        } else {
            $start = (int) $match[1];
            $end = $match[2] === '' ? $size - 1 : min((int) $match[2], $size - 1);
        }
        if ($start < 0 || $start >= $size || $end < $start) {
            http_response_code(416);
            header('Content-Range: bytes */' . $size);
            exit;
        }
        $status = 206;
    }

    http_response_code($status);
    header('X-Content-Type-Options: nosniff');
    header('Content-Type: application/pdf');
    header('Accept-Ranges: bytes');
    header('Content-Length: ' . ($end - $start + 1));
    header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode((string) $upload['fileName']));
    header('Cache-Control: private, max-age=86400');
    if ($status === 206) {
        header('Content-Range: bytes ' . $start . '-' . $end . '/' . $size);
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') {
        exit;
    }
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    $handle = fopen($file, 'rb');
    if ($handle === false) {
        exit;
    }
    fseek($handle, $start);
    $remaining = $end - $start + 1;
    while ($remaining > 0 && !feof($handle) && !connection_aborted()) {
        $chunk = fread($handle, min(1024 * 1024, $remaining));
        if ($chunk === false || $chunk === '') {
            break;
        }
        echo $chunk;
        flush();
        $remaining -= strlen($chunk);
    }
    fclose($handle);
    exit;
}

try {
    $defaultDataDirectory = calendar_config_value('APP_PUBLIC_URL') !== ''
        ? calendar_project_root() . DIRECTORY_SEPARATOR . 'storage'
        : calendar_project_root() . DIRECTORY_SEPARATOR . '.data' . DIRECTORY_SEPARATOR . 'php-api';
    $dataDirectory = calendar_config_value('CALENDAR_DATA_DIR', $defaultDataDirectory);
    $store = new CalendarStore($dataDirectory);
    $maxProjectBytes = calendar_config_int('MAX_SHARED_PROJECT_BYTES', 100 * 1024 * 1024);
    $maxPdfBytes = calendar_config_int('MAX_PDF_EXPORT_BYTES', 300 * 1024 * 1024);
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $path = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    $path = preg_replace('#^/api(?=/|$)#', '', $path) ?: '/';

    if ($method === 'OPTIONS') {
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Project-Lease, X-Upload-Token');
        header('Access-Control-Allow-Methods: GET, HEAD, POST, PUT, DELETE, OPTIONS');
        api_response(204);
    }

    if (($method === 'GET' || $method === 'HEAD') && preg_match('#^/v1/pdf-exports/([0-9a-f-]{36})/download/#i', $path, $match) === 1) {
        $upload = $store->readPdfUpload($match[1]);
        if ($upload === null) {
            calendar_fail('export_not_found', 404, 'PDF не найден');
        }
        api_serve_pdf($store, $upload);
    }

    if ($method === 'GET' && ($path === '/health' || $path === '/v1' || $path === '/')) {
        api_response(200, ['ok' => true, 'collaboration' => true, 'runtime' => 'php'], true);
    }

    if ($method === 'GET' && $path === '/v1/calendar-grid-templates') {
        api_response(200, ['templates' => $store->listGlobalTemplates(), 'canManage' => api_owner($store) !== null]);
    }

    if ($path === '/v1/unsubscribe' && in_array($method, ['GET', 'POST'], true)) {
        $token = is_string($_GET['token'] ?? null) ? $_GET['token'] : '';
        if ($method === 'POST') {
            $store->unsubscribe($token);
        }
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        header('Referrer-Policy: no-referrer');
        header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
        $action = htmlspecialchars('/api/v1/unsubscribe?token=' . rawurlencode($token), ENT_QUOTES, 'UTF-8');
        echo '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Подписка — Календарная мастерская</title><body style="font-family:Arial;padding:32px;max-width:600px;margin:auto;background:#fffdf8;color:#28483b;"><h1>Календарная мастерская</h1>';
        echo $method === 'POST' ? '<p>Вы отписались от рассылки. Доступ к календарям сохранён.</p>'
            : '<p>Отписаться от новостей и напоминаний? Доступ к календарям сохранится.</p><form method="post" action="' . $action . '"><button style="padding:16px;">Отписаться</button></form>';
        echo '</body></html>';
        exit;
    }

    if (str_starts_with($path, '/v1/admin/')) {
        if (api_owner($store) === null) api_response(403, ['error' => 'owner_required', 'message' => 'Этот раздел доступен только владельцу мастерской']);
        $offset = max(0, (int) ($_GET['offset'] ?? 0));
        if ($method === 'GET' && $path === '/v1/admin/calendars') api_response(200, $store->adminProjectPage($offset));
        if ($method === 'GET' && $path === '/v1/admin/subscribers') api_response(200, $store->subscriberPage($offset));
        if ($method === 'GET' && $path === '/v1/admin/mail-log') api_response(200, $store->mailLogPage($offset));
        if ($method === 'GET' && preg_match('#^/v1/admin/calendars/([0-9a-f-]{36})$#i', $path, $match)) {
            $stored = $store->readProject($match[1]);
            if ($stored === null) api_response(404, ['error' => 'project_not_found']);
            api_response(200, ['project' => $stored['project']]);
        }
        if ($method === 'POST' && $path === '/v1/admin/campaigns') {
            $body = api_request_json(32 * 1024);
            if (!is_string($body['subject'] ?? null) || !is_string($body['text'] ?? null)
                || trim($body['subject']) === '' || trim($body['text']) === ''
                || strlen($body['subject']) > 200 || strlen($body['text']) > 20000 || preg_match('/[\r\n]/', $body['subject'])) {
                api_response(400, ['error' => 'invalid_campaign', 'message' => 'Укажите тему до 200 байт и текст до 20 КБ']);
            }
            api_response(201, $store->createCampaign(trim($body['subject']), trim($body['text'])));
        }
        if ($method === 'POST' && preg_match('#^/v1/admin/campaigns/([0-9a-f-]{36})/send$#i', $path, $match)) {
            api_response(200, $store->dispatchCampaign($match[1]));
        }
        api_response(404, ['error' => 'not_found']);
    }

    if ($method === 'GET' && $path === '/v1/user-settings') {
        $settings = $store->programSettingsFor(api_bearer_token());
        $settings !== null
            ? api_response(200, $settings)
            : api_response(401, ['error' => 'email_required', 'message' => 'Сначала подтвердите e-mail']);
    }

    if ($method === 'POST' && $path === '/v1/email-verifications') {
        $body = api_request_json();
        if (!api_valid_email($body['email'] ?? null)) {
            api_response(400, ['error' => 'invalid_email', 'message' => 'Введите действующий e-mail']);
        }
        $email = strtolower(trim((string) $body['email']));
        if (isset($body['subscribe']) && !is_bool($body['subscribe'])) api_response(400, ['error' => 'invalid_consent']);
        if (!$store->consumeVerificationRateLimit($email, api_client_address())) {
            $retry = $store->verificationRetrySeconds($email, api_client_address());
            header('Retry-After: ' . $retry);
            api_response(429, ['error' => 'rate_limited', 'retryAfterSeconds' => $retry,
                'message' => 'Повторная отправка будет доступна через ' . $retry . ' сек. Если письмо уже пришло, используйте ссылку в нём.']);
        }
        if (isset($body['subscribe']) && !is_bool($body['subscribe'])) api_response(400, ['error' => 'invalid_consent']);
        $subscribe = ($body['subscribe'] ?? false) === true;
        $development = !str_starts_with(strtolower(calendar_config_value('APP_PUBLIC_URL')), 'https://');
        $accepted = false;
        $sendError = null;
        try {
            $verification = $store->createEmailVerification($email, $subscribe, ($body['browserFlow'] ?? false) === true);
            $link = api_public_url() . '/?verify=' . rawurlencode($verification['token']);
            calendar_send_verification_email($email, $link, $subscribe, ($body['browserFlow'] ?? false) === true);
            $accepted = true;
        } catch (RuntimeException $error) {
            $sendError = $error;
        } finally {
            $store->finishVerificationSend($email, api_client_address(), $accepted);
        }
        $store->logMail($email, 'verification', $accepted ? 'accepted' : 'failed');
        if ($sendError !== null && (!$development || !isset($verification))) {
                error_log('Calendar mail delivery: ' . $sendError->getMessage());
                api_response(502, [
                    'error' => 'mail_delivery_failed',
                    'message' => 'Не удалось отправить письмо. Проверьте настройки почты сервера.',
                ]);
        }
        $response = ['sent' => true, 'expiresAt' => $verification['expiresAt']];
        if (isset($verification['requestToken'])) $response['requestToken'] = $verification['requestToken'];
        if ($development) {
            $response['developmentVerificationUrl'] = $link;
        }
        api_response(201, $response);
    }

    if ($method === 'POST' && $path === '/v1/email-verifications/confirm') {
        $body = api_request_json();
        if (!is_string($body['token'] ?? null)) {
            api_response(400, ['error' => 'invalid_token']);
        }
        api_response(200, $store->confirmEmailVerification($body['token']));
    }

    if ($method === 'POST' && $path === '/v1/email-verifications/status') {
        // Secret is in the body, not a URL that could enter access logs or referrers.
        $body = api_request_json(1024);
        if (!is_string($body['requestToken'] ?? null)) api_response(400, ['error' => 'invalid_request']);
        api_response(200, $store->emailVerificationStatus($body['requestToken']));
    }

    if ($method === 'PUT' && $path === '/v1/user-settings') {
        $body = api_request_json(16 * 1024);
        $language = $body['interfaceLanguage'] ?? null;
        if (!in_array($language, ['ru', 'de', 'en', 'uk'], true)) {
            api_response(400, ['error' => 'invalid_settings', 'message' => 'Неизвестный язык интерфейса']);
        }
        $settings = $store->saveProgramSettings(api_bearer_token(), $language);
        $settings !== null
            ? api_response(200, $settings)
            : api_response(401, ['error' => 'email_required', 'message' => 'Сначала подтвердите e-mail']);
    }

    if ($method === 'POST' && $path === '/v1/calendar-grid-templates') {
        if (api_owner($store) === null) {
            api_response(403, ['error' => 'owner_required', 'message' => 'Управление общими макетами доступно только владельцу мастерской']);
        }
        $body = api_request_json(256 * 1024);
        if (!api_valid_grid_template($body)) {
            api_response(400, ['error' => 'invalid_grid_template', 'message' => 'Макет календарной сетки повреждён']);
        }
        api_response(201, $store->saveGlobalTemplate(['name' => $body['name'], 'description' => $body['description'], 'grid' => $body['grid']]));
    }

    if (preg_match('#^/v1/calendar-grid-templates/([0-9a-z-]{1,80})$#i', $path, $match) === 1 && in_array($method, ['PUT', 'DELETE'], true)) {
        if (api_owner($store) === null) {
            api_response(403, ['error' => 'owner_required', 'message' => 'Управление общими макетами доступно только владельцу мастерской']);
        }
        if ($method === 'DELETE') {
            $store->deleteGlobalTemplate($match[1]);
            api_response(204);
        }
        $body = api_request_json(256 * 1024);
        if (!api_valid_grid_template($body)) {
            api_response(400, ['error' => 'invalid_grid_template', 'message' => 'Макет календарной сетки повреждён']);
        }
        api_response(200, $store->saveGlobalTemplate(['name' => $body['name'], 'description' => $body['description'], 'grid' => $body['grid']], $match[1]));
    }

    if ($method === 'POST' && $path === '/v1/shared-projects') {
        $credential = $store->credentialFor(api_bearer_token());
        if ($credential === null) {
            api_response(401, ['error' => 'email_required', 'message' => 'Сначала подтвердите e-mail']);
        }
        $body = api_request_json($maxProjectBytes);
        $editor = api_editor($body);
        if (!api_valid_project($body['project'] ?? null) || $editor === null) {
            api_response(400, ['error' => 'invalid_project', 'message' => 'Проект повреждён']);
        }
        $stored = $store->createProject($body['project'], $credential['id']);
        $lease = $store->acquireLease($stored['id'], $editor['editorId'], $editor['editorLabel']);
        $response = api_lease_response($stored, $lease ?? []);
        $response['shareUrl'] = api_public_url() . '/?shared=' . rawurlencode((string) $stored['id']);
        api_response(201, $response);
    }

    if (preg_match('#^/v1/shared-projects/([0-9a-f-]{36})/lease$#i', $path, $match) === 1) {
        $projectId = $match[1];
        if ($method === 'POST') {
            $stored = $store->readProject($projectId);
            if ($stored === null) {
                api_response(404, ['error' => 'project_not_found', 'message' => 'Общий календарь не найден']);
            }
            $editor = api_editor(api_request_json());
            if ($editor === null) {
                api_response(400, ['error' => 'invalid_editor']);
            }
            $lease = $store->acquireLease($projectId, $editor['editorId'], $editor['editorLabel']);
            if ($lease === null) {
                $current = $store->activeLease($projectId);
                api_response(423, [
                    'status' => 'locked',
                    'projectId' => $projectId,
                    'project' => $stored['project'],
                    'revision' => $stored['revision'],
                    'editor' => [
                        'label' => $current['editorLabel'] ?? 'Другой редактор',
                        'lastSeenAt' => $current['lastSeenAt'] ?? calendar_now(),
                        'expiresAt' => $current['expiresAt'] ?? calendar_now(),
                    ],
                ]);
            }
            api_response(200, api_lease_response($stored, $lease));
        }
        if ($method === 'DELETE') {
            $store->releaseLease($projectId, api_header('X-Project-Lease'));
            api_response(204);
        }
    }

    if ($method === 'POST' && preg_match('#^/v1/shared-projects/([0-9a-f-]{36})/heartbeat$#i', $path, $match) === 1) {
        $lease = $store->refreshLease($match[1], api_header('X-Project-Lease'));
        $lease !== null
            ? api_response(200, ['expiresAt' => $lease['expiresAt']])
            : api_response(409, ['error' => 'lease_lost', 'message' => 'Право редактирования утрачено']);
    }

    if ($method === 'POST' && preg_match('#^/v1/shared-projects/([0-9a-f-]{36})/copy$#i', $path, $match) === 1) {
        $editor = api_editor(api_request_json());
        if ($editor === null) {
            api_response(400, ['error' => 'invalid_editor']);
        }
        $stored = $store->copyProject($match[1]);
        $lease = $store->acquireLease($stored['id'], $editor['editorId'], $editor['editorLabel']);
        $response = api_lease_response($stored, $lease ?? []);
        $response['shareUrl'] = api_public_url() . '/?shared=' . rawurlencode((string) $stored['id']);
        api_response(201, $response);
    }

    if ($method === 'PUT' && preg_match('#^/v1/shared-projects/([0-9a-f-]{36})$#i', $path, $match) === 1) {
        $body = api_request_json($maxProjectBytes);
        if (!api_valid_project($body['project'] ?? null) || !is_int($body['baseRevision'] ?? null)) {
            api_response(400, ['error' => 'invalid_project']);
        }
        $updated = $store->updateProject($match[1], api_header('X-Project-Lease'), $body['baseRevision'], $body['project']);
        api_response(200, ['revision' => $updated['revision'], 'updatedAt' => $updated['updatedAt']]);
    }

    if ($method === 'POST' && $path === '/v1/pdf-exports') {
        $credential = $store->credentialFor(api_bearer_token());
        if ($credential === null) {
            api_response(401, ['error' => 'email_required', 'message' => 'Сначала подтвердите e-mail']);
        }
        $body = api_request_json();
        $size = $body['size'] ?? null;
        if (!is_string($body['fileName'] ?? null) || !is_int($size) || $size <= 0 || $size > $maxPdfBytes) {
            api_response(400, ['error' => 'invalid_export', 'message' => 'PDF должен быть меньше ' . round($maxPdfBytes / 1024 / 1024) . ' МБ']);
        }
        $created = $store->createPdfUpload($credential['id'], $body['fileName'], $size);
        api_response(201, [
            'uploadId' => $created['upload']['id'],
            'uploadToken' => $created['uploadToken'],
            'chunkSize' => $created['upload']['chunkSize'],
        ]);
    }

    if ($method === 'PUT' && preg_match('#^/v1/pdf-exports/([0-9a-f-]{36})/chunks/(\d+)$#i', $path, $match) === 1) {
        $store->writePdfChunk($match[1], api_header('X-Upload-Token'), (int) $match[2], api_request_body(5 * 1024 * 1024));
        api_response(204);
    }

    if ($method === 'POST' && preg_match('#^/v1/pdf-exports/([0-9a-f-]{36})/complete$#i', $path, $match) === 1) {
        $upload = $store->completePdfUpload($match[1], api_header('X-Upload-Token'));
        api_response(200, [
            'downloadUrl' => api_public_url() . '/api/v1/pdf-exports/' . rawurlencode($upload['id']) . '/download/' . rawurlencode($upload['fileName']),
            'fileName' => $upload['fileName'],
            'size' => $upload['totalSize'],
        ]);
    }

    api_response(404, ['error' => 'not_found']);
} catch (ApiFailure $error) {
    api_response($error->httpStatus, ['error' => $error->errorCode, 'message' => $error->getMessage()]);
} catch (Throwable $error) {
    error_log('Calendar API: ' . $error);
    api_response(500, ['error' => 'server_error', 'message' => 'Внутренняя ошибка сервера']);
}
