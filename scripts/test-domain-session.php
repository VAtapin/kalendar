<?php
declare(strict_types=1);
putenv('APP_PUBLIC_URL=https://kalender.georg-kloster.ru');
require __DIR__.'/../public/api/lib.php';
$store=new CalendarStore(sys_get_temp_dir().'/calendar-domain-'.bin2hex(random_bytes(6)));
$link=$store->accountEmailLink('alias@example.org',false);
$token=$store->accountSetPassword($link['token'],'test-domain-password-123');
$ru='https://kalender.georg-kloster.ru';$de='https://kalender.georg-kloster.de';
function check(bool $ok):void{if(!$ok)throw new RuntimeException('Assertion failed');}
function denied(callable $fn):void{try{$fn();throw new RuntimeException('Expected rejection');}catch(ApiFailure $e){check(in_array($e->httpStatus,[400,403,410],true));}}
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
