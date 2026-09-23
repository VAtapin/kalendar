<?php
declare(strict_types=1);

require_once __DIR__ . '/api/lib.php';

$origin = rtrim(calendar_config_value('PUBLIC_API_URL'), '/');
$parts = parse_url($origin);
if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])
    || isset($parts['user'], $parts['pass'], $parts['query'], $parts['fragment']) || !empty($parts['path'])) {
    http_response_code(503);
    $origin = '';
}

header('Content-Type: application/javascript; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
echo 'globalThis.KalendarConfig=Object.freeze(' . json_encode(['publicApiUrl' => $origin], JSON_UNESCAPED_SLASHES) . ');';
