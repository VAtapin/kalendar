<?php
declare(strict_types=1);
putenv('APP_PUBLIC_URL='.$argv[1]);
require __DIR__.'/../public/api/lib.php';
foreach (['https://kalender.georg-kloster.ru','https://kalender.georg-kloster.de'] as $origin) {
    $_SERVER['HTTP_ORIGIN']=$origin; calendar_admin_check_origin();
}
foreach (['', 'null', 'https://evil.example', 'http://kalender.georg-kloster.de', 'https://kalender.georg-kloster.de.evil.example', 'https://kalender.georg-kloster.de:444'] as $origin) {
    $_SERVER['HTTP_ORIGIN']=$origin;
    try { calendar_admin_check_origin(); throw new RuntimeException('Unsafe origin accepted'); }
    catch (ApiFailure $e) { if($e->errorCode!=='invalid_origin')throw $e; }
}
echo "PASS: both aliases accepted, hostile origins rejected\n";
