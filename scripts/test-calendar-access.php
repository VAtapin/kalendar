<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/lib.php';
require_once __DIR__ . '/../public/api/calendar-access.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function fails(callable $call, string $code): void {
    try { $call(); } catch (ApiFailure $error) { check($error->errorCode === $code, 'Unexpected error: '.$error->errorCode); return; }
    throw new RuntimeException('Expected '.$code);
}
$directory = $argv[1] ?? throw new RuntimeException('Isolated data directory required');
$store = new CalendarApiAccessStore($directory);
$body = ['name'=>'Test client','email'=>'test@example.invalid','planId'=>'free','enabled'=>true,'expiresAt'=>null];
$created = $store->saveClient($body); $client = $created['client']; $key = $created['key'];
check(preg_match('/^cal_[a-f0-9]{64}$/', $key) === 1, 'Key format');
check(!isset($client['keyHash']) && !str_contains(json_encode($store->overview()), $key), 'Overview exposes secret');
check(!str_contains(file_get_contents($directory.'/api-access.json'), $key), 'Stored plaintext key');
if (($argv[2] ?? '') === '--fixture') { echo $key; exit; }
$now = strtotime('2026-09-09T12:00:00Z');
fails(fn()=>$store->authorize('bad', $now), 'invalid_api_key');
fails(fn()=>$store->authorize('cal_'.str_repeat('0',64), $now), 'invalid_api_key');
$store->authorize($key,$now);
$rotated=$store->rotate($client['id'],$client['revision']);
fails(fn()=>$store->authorize($key,$now), 'invalid_api_key');
fails(fn()=>$store->rotate($client['id'],$client['revision']), 'revision_conflict');
$key=$rotated['key'];$client=$rotated['client'];
check($client['totalRequests']===1, 'Rotation resets quota');
$saved=$store->saveClient($body+['revision'=>$client['revision']],$client['id']);$client=$saved['client'];
$disabled=$store->saveClient(array_merge($body,['enabled'=>false,'revision'=>$client['revision']]),$client['id']);
fails(fn()=>$store->authorize($key,$now), 'api_access_disabled');
$expired=$store->saveClient(array_merge($body,['expiresAt'=>'2026-09-08','revision'=>$disabled['client']['revision']]),$client['id']);
fails(fn()=>$store->authorize($key,$now), 'api_key_expired');
$enabled=$store->saveClient(array_merge($body,['expiresAt'=>'2026-09-09','revision'=>$expired['client']['revision']]),$client['id']);
$store->authorize($key,$now); // expiry is inclusive
$config=$store->overview();$config['plans'][0]['perMinute']=2;$config['plans'][0]['perDay']=3;$config['plans'][0]['perMonth']=4;
$store->configure($config);
fails(fn()=>$store->authorize($key,$now),'api_minute_limit');
$store->authorize($key,$now+60);
fails(fn()=>$store->authorize($key,$now+120),'api_day_limit');
$store->saveClient(array_merge($body,['revision'=>$enabled['client']['revision']]),$client['id']);
$store->authorize($key,$now+86400);
fails(fn()=>$store->authorize($key,$now+86460),'api_month_limit');
$store->authorize($key,strtotime('2026-10-01T00:00:00Z'));
$config=$store->overview();$config['plans'][0]['enabled']=false;$store->configure($config);
fails(fn()=>$store->authorize($key,$now),'api_access_disabled');
$config=$store->overview();$config['plans']=['bad'];fails(fn()=>$store->configure($config),'invalid_plan');
fails(fn()=>$store->saveClient(['name'=>[]]),'invalid_client');
fails(fn()=>$store->saveClient(array_merge($body,['expiresAt'=>'2026-02-30'])),'invalid_expiry');
echo "PASS: issuance, hash-only persistence, validation, rotation, disabled client/plan, inclusive expiry, all UTC quotas and rollover\n";
