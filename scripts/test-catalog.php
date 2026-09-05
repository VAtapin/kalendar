<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/lib.php';
$directory = __DIR__ . '/../tmp/catalog-test-' . bin2hex(random_bytes(5));
$store = new CalendarStore($directory);
function check_catalog(bool $value, string $label): void { if (!$value) throw new RuntimeException($label); echo "PASS: $label\n"; }
$png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=';
$item = $store->catalogSave('resource-test', ['name' => 'Photo', 'kind' => 'image', 'source' => $png, 'enabled' => true]);
check_catalog($item['widthPx'] === 1 && $store->catalogContent('resource-test')['mimeType'] === 'image/png', 'Raster inspected and served with verified MIME');
$store->catalogSave('resource-test', ['name' => 'Renamed', 'enabled' => false]);
check_catalog($store->catalogItems()[0]['enabled'] === false && $store->catalogContent('resource-test')['body'] === base64_decode($png), 'Disabling preserves existing content');
foreach ([['kind' => 'image', 'source' => base64_encode('<?php evil ?>')], ['kind' => 'font', 'source' => base64_encode('not a font')]] as $bad) {
    try { $store->catalogSave('bad', ['name' => 'Bad', ...$bad]); throw new RuntimeException('Accepted invalid file'); }
    catch (ApiFailure $e) { check_catalog($e->httpStatus === 400, 'Invalid file rejected'); }
}
if (class_exists('DOMDocument')) {
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#b59032" d="M0 0L100 100"/></svg>';
    $store->catalogSave('resource-svg', ['name' => 'SVG', 'kind' => 'svg', 'source' => base64_encode($svg)]);
    check_catalog($store->catalogContent('resource-svg')['body'] === $svg, 'Safe SVG accepted');
    foreach (['<script>alert(1)</script>', '<image href="https://example.org/a"/>', '<rect onload="alert(1)"/>', '<foreignObject/>'] as $unsafe) {
        try { $store->catalogSave('bad', ['name' => 'Unsafe', 'kind' => 'svg', 'source' => base64_encode('<svg xmlns="http://www.w3.org/2000/svg">' . $unsafe . '</svg>')]); throw new RuntimeException('Unsafe SVG accepted'); }
        catch (ApiFailure $e) { check_catalog($e->httpStatus === 400, 'Active SVG rejected'); }
    }
} else throw new RuntimeException('PHP DOM missing: install DOM before validating SVG uploads');
