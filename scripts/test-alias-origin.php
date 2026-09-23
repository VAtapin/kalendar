<?php
declare(strict_types=1);
putenv('APP_PUBLIC_URL='.$argv[1]);
putenv('APP_PUBLIC_ALIASES='.($argv[2]??''));
putenv('APP_GERMAN_PUBLIC_URL='.($argv[3]??''));
require __DIR__.'/../public/api/lib.php';
foreach (calendar_public_origins() as $origin) {
    $_SERVER['HTTP_ORIGIN']=$origin; calendar_admin_check_origin();
}
foreach (['', 'null', 'https://evil.example', 'http://calendar.example', 'https://calendar.example.evil.example', 'https://calendar.example:444'] as $origin) {
    $_SERVER['HTTP_ORIGIN']=$origin;
    try { calendar_admin_check_origin(); throw new RuntimeException('Unsafe origin accepted'); }
    catch (ApiFailure $e) { if($e->errorCode!=='invalid_origin')throw $e; }
}
echo "PASS: both aliases accepted, hostile origins rejected\n";
