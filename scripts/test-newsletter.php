<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/lib.php';
function check_newsletter(bool $condition, string $label): void {
    if (!$condition) throw new RuntimeException($label);
    echo "PASS: $label\n";
}
$blocks = [
    ['type' => 'heading', 'text' => '<script>alert(1)</script>'],
    ['type' => 'text', 'text' => "Первая строка\nВторая строка"],
    ['type' => 'image', 'text' => 'Монастырь "летом"', 'url' => 'https://example.org/photo.png'],
    ['type' => 'button', 'text' => 'Богослужения', 'url' => 'https://georg-kloster.ru/raspisanie-bogosluzheniy/'],
];
$content = calendar_newsletter_content($blocks);
check_newsletter(!str_contains($content['html'], '<script>'), 'Text cannot inject HTML');
check_newsletter(str_contains($content['html'], '&lt;script&gt;'), 'Literal text preserved');
check_newsletter(str_contains($content['html'], '<img ') && str_contains($content['html'], '&quot;летом&quot;'), 'Image and escaped alt rendered');
check_newsletter(str_contains($content['text'], 'https://georg-kloster.ru/raspisanie-bogosluzheniy/'), 'Plain text retains links');
foreach (['javascript:alert(1)', 'data:image/png;base64,abc', 'http://example.org/image.png', 'https://user:pass@example.org/a'] as $url) {
    try { calendar_newsletter_blocks([['type' => 'image', 'text' => '', 'url' => $url]]); throw new RuntimeException('Unsafe URL accepted'); }
    catch (ApiFailure $e) { check_newsletter($e->httpStatus === 400, 'Unsafe URL rejected'); }
}
try { calendar_newsletter_blocks(array_fill(0, 41, ['type' => 'text', 'text' => 'x'])); throw new RuntimeException('Too many blocks'); }
catch (ApiFailure $e) { check_newsletter($e->httpStatus === 400, 'Block limit enforced'); }
$draftBlocks = [['type'=>'image','text'=>'Unfinished image','url'=>'']];
check_newsletter(count(calendar_newsletter_blocks($draftBlocks, true)) === 1, 'Incomplete draft can be saved');
try { calendar_newsletter_blocks($draftBlocks); throw new RuntimeException('Incomplete draft sent'); }
catch (ApiFailure $e) { check_newsletter($e->httpStatus === 400, 'Incomplete draft cannot be sent'); }
