<?php
declare(strict_types=1);
// Public bundled font, also usable by the standalone file:// API inspector.
// A fixed path only: this endpoint never accepts filesystem paths from callers.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
header('X-Content-Type-Options: nosniff');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') { http_response_code(204); exit; }
if (!in_array($method, ['GET', 'HEAD'], true)) {
    header('Allow: GET, HEAD, OPTIONS'); http_response_code(405); exit;
}
$font = __DIR__ . '/fonts/MonomakhUnicode.ttf';
if (!is_file($font)) { http_response_code(404); exit; }
header('Content-Type: font/ttf');
header('Cache-Control: public, max-age=3600');
header('Content-Length: ' . filesize($font));
if ($method !== 'HEAD') readfile($font);
