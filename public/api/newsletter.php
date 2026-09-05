<?php
declare(strict_types=1);

/** Structured email blocks: never accept executable, arbitrary HTML. */
function calendar_newsletter_blocks(mixed $blocks): array
{
    if (!is_array($blocks) || !array_is_list($blocks) || count($blocks) > 40) calendar_fail('invalid_blocks', 400);
    $result = [];
    foreach ($blocks as $block) {
        if (!is_array($block) || !in_array($block['type'] ?? '', ['heading', 'text', 'image', 'button'], true)) calendar_fail('invalid_block', 400);
        $text = $block['text'] ?? '';
        if (!is_string($text) || strlen($text) > 12000) calendar_fail('invalid_block_text', 400);
        $url = $block['url'] ?? '';
        if (in_array($block['type'], ['image', 'button'], true)) {
            if (!is_string($url) || strlen($url) > 2048 || !filter_var($url, FILTER_VALIDATE_URL)
                || strtolower((string) parse_url($url, PHP_URL_SCHEME)) !== 'https'
                || parse_url($url, PHP_URL_USER) !== null) calendar_fail('invalid_block_url', 400, 'Нужна полная HTTPS-ссылка');
        } else $url = '';
        $result[] = ['type' => $block['type'], 'text' => $text, 'url' => $url];
    }
    return $result;
}

function calendar_newsletter_content(array $blocks): array
{
    $escape = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $html = ''; $plain = [];
    foreach (calendar_newsletter_blocks($blocks) as $block) {
        $text = $escape($block['text']); $url = $escape($block['url']);
        $html .= match ($block['type']) {
            'heading' => '<h2 style="font-family:Georgia,serif;color:#28483b;">' . $text . '</h2>',
            'image' => '<p><img src="' . $url . '" alt="' . $text . '" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;"></p>',
            'button' => '<p style="margin:24px 0;"><a href="' . $url . '" style="display:inline-block;background:#28483b;color:#ffffff;padding:14px 22px;text-decoration:none;border-radius:4px;">' . $text . '</a></p>',
            default => '<p style="line-height:1.7;">' . nl2br($text) . '</p>',
        };
        $plain[] = $block['text'] . ($block['url'] !== '' ? "\n" . $block['url'] : '');
    }
    return ['html' => $html, 'text' => implode("\n\n", $plain)];
}
