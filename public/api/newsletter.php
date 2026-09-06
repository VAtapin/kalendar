<?php
declare(strict_types=1);

function calendar_block_style(mixed $style): array {
    if (!is_array($style)) return [];
    $clean=[];
    if (isset($style['align']) && in_array($style['align'],['left','center','right'],true)) $clean['align']=$style['align'];
    if (isset($style['fontSize']) && is_numeric($style['fontSize'])) $clean['fontSize']=max(10,min(48,(float)$style['fontSize']));
    if (isset($style['color']) && is_string($style['color']) && preg_match('/^#[0-9a-f]{6}$/iD',$style['color'])) $clean['color']=$style['color'];
    foreach(['bold','italic'] as $key) if (isset($style[$key]) && is_bool($style[$key])) $clean[$key]=$style[$key];
    return $clean;
}
function calendar_block_css(array $style): string {
    $s=calendar_block_style($style);$css='';
    if(isset($s['align']))$css.='text-align:'.$s['align'].';';
    if(isset($s['fontSize']))$css.='font-size:'.$s['fontSize'].'px;';
    if(isset($s['color']))$css.='color:'.$s['color'].';';
    if(isset($s['bold']))$css.='font-weight:'.($s['bold']?'bold':'normal').';';
    if(isset($s['italic']))$css.='font-style:'.($s['italic']?'italic':'normal').';';
    return $css;
}

/** Structured email blocks: never accept executable, arbitrary HTML. */
function calendar_newsletter_blocks(mixed $blocks, bool $draft = false): array
{
    if (!is_array($blocks) || !array_is_list($blocks) || count($blocks) > 40) calendar_fail('invalid_blocks', 400);
    $result = [];
    foreach ($blocks as $block) {
        if (!is_array($block) || !in_array($block['type'] ?? '', ['heading', 'text', 'image', 'button'], true)) calendar_fail('invalid_block', 400);
        $text = $block['text'] ?? '';
        if (!is_string($text) || strlen($text) > 12000) calendar_fail('invalid_block_text', 400);
        $url = $block['url'] ?? '';
        if (!is_string($url)) calendar_fail('invalid_block_url', 400);
        if (in_array($block['type'], ['image', 'button'], true)) {
            if (!($draft && $url === '') && (strlen($url) > 2048 || !filter_var($url, FILTER_VALIDATE_URL)
                || strtolower((string) parse_url($url, PHP_URL_SCHEME)) !== 'https'
                || parse_url($url, PHP_URL_USER) !== null)) calendar_fail('invalid_block_url', 400, 'Нужна полная HTTPS-ссылка');
        } else $url = '';
        $clean = ['type' => $block['type'], 'text' => $text, 'url' => $url];
        if(isset($block['style']))$clean['style']=calendar_block_style($block['style']);
        $result[]=$clean;
    }
    return $result;
}

function calendar_newsletter_content(array $blocks): array
{
    $escape = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $html = ''; $plain = [];
    foreach (calendar_newsletter_blocks($blocks) as $block) {
        $text = $escape($block['text']); $url = $escape($block['url']);
        $css=calendar_block_css($block['style']??[]);
        $html .= match ($block['type']) {
            'heading' => '<h2 style="font-family:Georgia,serif;color:#28483b;'.$css.'">' . $text . '</h2>',
            'image' => '<p><img src="' . $url . '" alt="' . $text . '" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;"></p>',
            'button' => '<p style="margin:24px 0;"><a href="' . $url . '" style="display:inline-block;background:#28483b;color:#ffffff;padding:14px 22px;text-decoration:none;border-radius:4px;">' . $text . '</a></p>',
            default => '<p style="line-height:1.7;'.$css.'">' . nl2br($text) . '</p>',
        };
        $plain[] = $block['text'] . ($block['url'] !== '' ? "\n" . $block['url'] : '');
    }
    return ['html' => $html, 'text' => implode("\n\n", $plain)];
}
