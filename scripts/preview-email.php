<?php

declare(strict_types=1);

// CLI only: generate a preview without sending email or creating a login token.
if (PHP_SAPI !== 'cli') {
    exit(1);
}
require_once __DIR__ . '/../public/api/lib.php';

$url = 'https://kalender.georg-kloster.ru/?verify=PREVIEW-NOT-A-REAL-TOKEN';
$html = calendar_verification_html('reader@example.org', $url);
$escaped = calendar_verification_html('<reader@example.org>', $url . '&test="value"');
if (!str_contains($escaped, '&lt;reader@example.org&gt;') || !str_contains($escaped, '&amp;test=&quot;value&quot;')) {
    throw new RuntimeException('Email escaping failed');
}
$message = calendar_verification_message('reader@example.org', $url, 'kalender@georg-kloster.ru', 'Календарная мастерская');
if (!str_contains(implode("\n", $message['headers']), 'multipart/alternative')) {
    throw new RuntimeException('Missing text alternative');
}
$parts = explode('Content-Transfer-Encoding: base64', $message['body']);
if (count($parts) !== 3) {
    throw new RuntimeException('Expected exactly two MIME alternatives');
}
// Compare MIME payload independently of the generated boundary.
$htmlPayload = preg_split('/\r\n--/', trim($parts[2]))[0];
if (base64_decode($htmlPayload, true) !== $html) {
    throw new RuntimeException('HTML MIME round-trip failed');
}
$directory = __DIR__ . '/../tmp/email-preview';
if (!is_dir($directory)) {
    mkdir($directory, 0755, true);
}
file_put_contents($directory . '/verification.html', $html);
echo "Email escaping and MIME checks passed. Preview: tmp/email-preview/verification.html\n";
