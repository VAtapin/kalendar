<?php
require __DIR__.'/../public/api/lib.php';
$clean=calendar_page_html('<h2>Заголовок</h2><p><strong>Текст</strong></p><ul><li>Пункт</li></ul><script>alert(1)</script><svg onload="alert(1)"></svg><a href="javascript:alert(2)" onclick="alert(3)">bad</a><a href="https://atapin.de/">good</a>');
if(str_contains($clean,'alert') || str_contains($clean,'onclick') || !str_contains($clean,'<strong>Текст</strong>') || !str_contains($clean,'href="https://atapin.de/"')) throw new RuntimeException($clean);
echo "PASS: HTML formatting preserved; executable content removed\n";
