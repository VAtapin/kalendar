<?php
declare(strict_types=1);

trait CalendarCatalog
{
    public function catalogItems(): array { return array_values(calendar_read_json_file($this->dataDirectory . '/catalog.json', [])); }
    public function catalogSave(string $id, array $body): array {
        if (!preg_match('/^[a-zA-Z0-9_-]{1,100}$/', $id)) calendar_fail('invalid_resource', 400);
        return calendar_with_lock($this->locksDirectory, 'catalog', function () use ($id, $body): array {
            $items = calendar_read_json_file($this->dataDirectory . '/catalog.json', []);
            $old = $items[$id] ?? ['id' => $id, 'enabled' => true];
            $name = trim((string)($body['name'] ?? $old['name'] ?? ''));
            if ($name === '' || strlen($name) > 300) calendar_fail('invalid_name', 400);
            $item = array_merge($old, ['name' => $name, 'enabled' => ($body['enabled'] ?? $old['enabled']) === true,
                'category' => calendar_text_slice((string)($body['category'] ?? $old['category'] ?? 'ornaments'), 80), 'updatedAt' => calendar_now()]);
            if (isset($body['source'])) {
                $kind = $body['kind'] ?? '';
                if (!in_array($kind, ['image', 'svg', 'font', 'template'], true) || !is_string($body['source'])) calendar_fail('invalid_resource', 400);
                $raw = base64_decode($body['source'], true);
                if ($raw === false || strlen($raw) > 20 * 1024 * 1024) calendar_fail('resource_too_large', 413);
                if ($kind === 'image') {
                    $size = @getimagesizefromstring($raw);
                    if (!$size || !in_array($size['mime'], ['image/png', 'image/jpeg', 'image/webp'], true) || $size[0] * $size[1] > 80000000) calendar_fail('invalid_image', 400);
                    $item['mimeType'] = $size['mime']; $item['widthPx'] = $size[0]; $item['heightPx'] = $size[1];
                } elseif ($kind === 'svg') {
                    if (!class_exists('DOMDocument')) calendar_fail('xml_unavailable', 503, 'Включите PHP DOM/XML для загрузки SVG');
                    if (stripos($raw, '<!DOCTYPE') !== false || stripos($raw, '<!ENTITY') !== false) calendar_fail('unsafe_svg', 400);
                    $doc = new DOMDocument();
                    if (!@$doc->loadXML($raw, LIBXML_NONET) || $doc->documentElement?->localName !== 'svg') calendar_fail('invalid_svg', 400);
                    foreach ($doc->getElementsByTagName('*') as $node) {
                        if (in_array(strtolower($node->localName), ['script', 'foreignobject', 'iframe', 'animate', 'set', 'animatetransform', 'animatemotion'], true)) calendar_fail('unsafe_svg', 400);
                        foreach ($node->attributes as $attribute) {
                            $n = strtolower($attribute->localName); $v = trim($attribute->value);
                            if (str_starts_with($n, 'on') || ($n === 'href' && !str_starts_with($v, '#')) || preg_match('/(?:https?:|javascript:|data:|@import)/i', $v)) calendar_fail('unsafe_svg', 400);
                        }
                        if (strtolower($node->localName) === 'style' && preg_match('/(?:https?:|javascript:|data:|@import)/i', $node->textContent)) calendar_fail('unsafe_svg', 400);
                    }
                    $item['mimeType'] = 'image/svg+xml';
                } elseif ($kind === 'font') {
                    if (!in_array(substr($raw, 0, 4), ["\x00\x01\x00\x00", 'OTTO', 'wOFF', 'wOF2'], true)) calendar_fail('invalid_font', 400);
                    $item['mimeType'] = match(substr($raw, 0, 4)) { 'OTTO' => 'font/otf', 'wOFF' => 'font/woff', 'wOF2' => 'font/woff2', default => 'font/ttf' };
                    $family = trim((string)($body['family'] ?? $name));
                    if (!preg_match('/^[\p{L}\p{N} _-]{1,100}$/u', $family)) calendar_fail('invalid_font_family', 400);
                    $item['family'] = $family;
                } else {
                    $project = json_decode($raw, true);
                    $project = $project['project'] ?? $project;
                    if (!api_valid_project($project)) calendar_fail('invalid_template', 400);
                    $raw = json_encode($project, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
                    $item['mimeType'] = 'application/json';
                }
                $directory = $this->dataDirectory . '/catalog-files'; if (!is_dir($directory)) mkdir($directory, 0700, true);
                calendar_atomic_json_write($directory . '/' . $id . '.json', ['base64' => base64_encode($raw)]);
                $item['kind'] = $kind; $item['bytes'] = strlen($raw); $item['uploaded'] = true;
            }
            $items[$id] = $item; calendar_atomic_json_write($this->dataDirectory . '/catalog.json', $items); return $item;
        });
    }
    public function catalogContent(string $id): array {
        if (!preg_match('/^[a-zA-Z0-9_-]{1,100}$/', $id)) calendar_fail('not_found', 404);
        $items = calendar_read_json_file($this->dataDirectory . '/catalog.json', []);
        $item = $items[$id] ?? null;
        if (!$item || !($item['uploaded'] ?? false)) calendar_fail('not_found', 404);
        $raw = calendar_read_json_file($this->dataDirectory . '/catalog-files/' . $id . '.json', null);
        if (!$raw) calendar_fail('not_found', 404);
        return ['mimeType' => $item['mimeType'], 'body' => base64_decode($raw['base64'])];
    }
}

function calendar_catalog_routes(CalendarStore $store, string $method, string $path): void {
    if ($path === '/v1/catalog' && $method === 'GET') api_response(200, ['items' => $store->catalogItems()]);
    if ($method === 'GET' && preg_match('#^/v1/catalog/([a-zA-Z0-9_-]{1,100})/content$#', $path, $m)) {
        $content = $store->catalogContent($m[1]);
        header('Content-Type: ' . $content['mimeType']); header('X-Content-Type-Options: nosniff');
        header("Content-Security-Policy: default-src 'none'; sandbox"); header('Cache-Control: no-cache');
        echo $content['body']; exit;
    }
    if (!str_starts_with($path, '/v1/admin/catalog') && !str_starts_with($path, '/v1/admin/accounts') && !str_starts_with($path, '/v1/admin/private-calendars')) return;
    if (api_owner($store) === null) calendar_fail('owner_required', 403);
    if (!in_array($method, ['GET', 'HEAD'], true)) calendar_admin_check_origin();
    if ($path === '/v1/admin/accounts' && $method === 'GET') api_response(200, ['items' => $store->accountUsers()]);
    if ($method === 'PUT' && preg_match('#^/v1/admin/accounts/([0-9a-f-]{36})$#', $path, $m)) {
        $body = api_request_json(2048); if (!is_bool($body['blocked'] ?? null)) calendar_fail('invalid_body', 400);
        $store->accountBlock($m[1], $body['blocked']); api_response(204);
    }
    if ($path === '/v1/admin/private-calendars' && $method === 'GET') api_response(200, ['items' => $store->accountCalendars(null)]);
    if ($path === '/v1/admin/private-calendars-trash' && $method === 'GET') api_response(200, ['items' => $store->accountTrash()]);
    if ($path === '/v1/admin/private-calendars-trash/restore' && $method === 'POST') { $body = api_request_json(2048); $store->accountRestoreTrash((string)($body['id'] ?? '')); api_response(200, ['ok' => true]); }
    if (preg_match('#^/v1/admin/private-calendars/([0-9a-f-]{36})$#', $path, $m)) {
        if ($method === 'GET') { $value = $store->accountCalendar($m[1], null); unset($value['history']); api_response(200, $value); }
        if ($method === 'DELETE') { $store->accountDeleteCalendar($m[1], null); api_response(204); }
    }
    if ($path === '/v1/admin/catalog' && $method === 'POST') api_response(201, $store->catalogSave('resource-' . calendar_uuid(), api_request_json(30 * 1024 * 1024)));
    if ($method === 'PUT' && preg_match('#^/v1/admin/catalog/([a-zA-Z0-9_-]{1,100})$#', $path, $m)) api_response(200, $store->catalogSave($m[1], api_request_json(30 * 1024 * 1024)));
    api_response(404, ['error' => 'not_found']);
}
