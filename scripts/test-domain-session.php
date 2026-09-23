<?php
declare(strict_types=1);
putenv('APP_PUBLIC_URL=https://calendar.example');
putenv('APP_GERMAN_PUBLIC_URL=https://kalender-de.example');
putenv('APP_PUBLIC_ALIASES=https://calendar.example,https://kalender-de.example');
require __DIR__.'/../public/api/lib.php';
$store=new CalendarStore(sys_get_temp_dir().'/calendar-domain-'.bin2hex(random_bytes(6)));
$link=$store->accountEmailLink('alias@example.org',false);
$token=$store->accountSetPassword($link['token'],'test-domain-password-123');
$ru='https://calendar.example';$de='https://kalender-de.example';
function check(bool $ok):void{if(!$ok)throw new RuntimeException('Assertion failed');}
function denied(callable $fn):void{try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiFailure $e){check(in_array($e->httpStatus,[400,403,410],true));}}
check(calendar_public_origin()===$ru);
check(calendar_public_origins()===[$ru,$de]);
check(calendar_public_url('/api/v1/calendar/')===$ru.'/api/v1/calendar/');
$mail=calendar_verification_html('alias@example.org',$ru.'/verify');
check(str_contains($mail,$ru.'/brand/logo-kalendar.png')&&!str_contains($mail,'kalender.georg-kloster.ru'));
$created=$store->domainSession('create',['target'=>$de,'path'=>'/account'],$ru,'',$token,'');
parse_str(parse_url($created['url'],PHP_URL_FRAGMENT),$fragment);$id=$fragment['session-bind'];
$bound=$store->domainSession('bind',['id'=>$id],$de,'','','');
denied(fn()=>$store->domainSession('authorize',['id'=>$id],$ru,'attacker',$token,''));
denied(fn()=>$store->domainSession('authorize',['id'=>$id],$de,$created['binding'],$token,''));
$store->domainSession('authorize',['id'=>$id],$ru,$created['binding'],$token,'');
denied(fn()=>$store->domainSession('redeem',['id'=>$id],$de,'attacker','',''));
$redeemed=$store->domainSession('redeem',['id'=>$id],$de,$bound['binding'],'','');
check($redeemed['account']===$token && $redeemed['url']===$de.'/account');
denied(fn()=>$store->domainSession('redeem',['id'=>$id],$de,$bound['binding'],'',''));
$store->accountLogout($token);check($store->accountUser($redeemed['account'])===null);
denied(fn()=>$store->domainSession('create',['target'=>'https://evil.example','path'=>'/'],$ru,'','',''));
denied(fn()=>$store->domainSession('create',['target'=>$de,'path'=>'//evil.example'],$ru,'','',''));
check($store->domainSession('create',['target'=>$de,'path'=>'/account'],$ru,'','','')['url']===$de.'/account');
echo "PASS: browser binding, origin binding, one-time redemption, shared logout, open redirects denied, anonymous fallback\n";
