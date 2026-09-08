<?php
declare(strict_types=1);

final class CalendarApiAccessStore {
    private string $directory;
    public function __construct(?string $directory = null) {
        $this->directory = $directory ?? calendar_config_value('CALENDAR_DATA_DIR', calendar_project_root() . '/storage');
    }
    private function state(): array {
        return calendar_read_json_file($this->directory . '/api-access.json', [
            'revision' => 0, 'plans' => [
                ['id'=>'free','name'=>'Free','priceCents'=>0,'currency'=>'EUR','perMinute'=>30,'perDay'=>300,'perMonth'=>1000,'enabled'=>true,'published'=>true],
                ['id'=>'standard','name'=>'Standard','priceCents'=>1000,'currency'=>'EUR','perMinute'=>60,'perDay'=>2000,'perMonth'=>10000,'enabled'=>false,'published'=>false],
                ['id'=>'pro','name'=>'Pro','priceCents'=>2900,'currency'=>'EUR','perMinute'=>120,'perDay'=>10000,'perMonth'=>100000,'enabled'=>false,'published'=>false],
            ], 'clients'=>[], 'settings'=>['contactEmail'=>'','wordpressUrl'=>''],
        ]);
    }
    private function write(array $state): void { calendar_atomic_json_write($this->directory . '/api-access.json', $state); }
    private function locked(callable $action): mixed { return calendar_with_lock($this->directory . '/locks', 'calendar-api-access', $action); }
    private function cleanClient(array $client): array { unset($client['keyHash']); return $client; }
    public function overview(): array {
        $state = $this->state();
        $state['clients'] = array_values(array_map(fn($client) => $this->cleanClient($client), $state['clients']));
        $state['serverTime'] = calendar_now();
        return $state;
    }
    public function publicPlans(): array {
        $state = $this->state();
        return ['plans'=>array_values(array_filter($state['plans'], static fn($plan) => $plan['published'] && $plan['enabled'])),
            'settings'=>$state['settings'], 'billing'=>'manual', 'period'=>'calendar-month-UTC'];
    }
    public function configure(array $body): array {
        return $this->locked(function() use ($body): array {
            $state = $this->state();
            if (($body['revision'] ?? null) !== $state['revision']) calendar_fail('revision_conflict',409,'Настройки изменены. Обновите страницу.');
            $plans = $body['plans'] ?? null;
            if (!is_array($plans) || count($plans)<1 || count($plans)>20) calendar_fail('invalid_plans',400);
            $ids=[]; $validated=[];
            foreach ($plans as $plan) {
                if (!is_array($plan) || !is_string($plan['name'] ?? null)) calendar_fail('invalid_plan',400);
                $id=$plan['id']??''; $name=trim((string)($plan['name']??''));
                if (!is_string($id) || !preg_match('/^[a-z0-9-]{1,40}$/',$id) || isset($ids[$id]) || $name==='' || strlen($name)>120) calendar_fail('invalid_plan',400);
                $ids[$id]=true;
                foreach (['priceCents'=>10000000,'perMinute'=>10000,'perDay'=>10000000,'perMonth'=>100000000] as $field=>$max) {
                    if (!is_int($plan[$field]??null) || $plan[$field]<($field==='priceCents'?0:1) || $plan[$field]>$max) calendar_fail('invalid_plan_limit',400);
                }
                if ($plan['perMinute']>$plan['perDay'] || $plan['perDay']>$plan['perMonth']) calendar_fail('invalid_plan_limit',400,'Лимит минуты ≤ лимит дня ≤ лимит месяца.');
                $validated[]=['id'=>$id,'name'=>$name,'priceCents'=>$plan['priceCents'],'currency'=>'EUR','perMinute'=>$plan['perMinute'],
                    'perDay'=>$plan['perDay'],'perMonth'=>$plan['perMonth'],'enabled'=>($plan['enabled']??false)===true,'published'=>($plan['published']??false)===true];
            }
            foreach ($state['clients'] as $client) if (!isset($ids[$client['planId']])) calendar_fail('plan_in_use',409,'Тариф используется клиентом; отключите его вместо удаления.');
            if (!is_array($body['settings'] ?? null) || !is_string($body['settings']['contactEmail'] ?? null) || !is_string($body['settings']['wordpressUrl'] ?? null)) calendar_fail('invalid_settings',400);
            $email=trim((string)($body['settings']['contactEmail']??'')); $url=trim((string)($body['settings']['wordpressUrl']??''));
            if ($email!=='' && !filter_var($email,FILTER_VALIDATE_EMAIL)) calendar_fail('invalid_email',400);
            if (strlen($email)>254 || strlen($url)>1000 || ($url!=='' && (!filter_var($url,FILTER_VALIDATE_URL) || parse_url($url,PHP_URL_SCHEME)!=='https' || parse_url($url,PHP_URL_USER)!==null || parse_url($url,PHP_URL_PASS)!==null))) calendar_fail('invalid_url',400);
            $state['plans']=$validated; $state['settings']=['contactEmail'=>$email,'wordpressUrl'=>$url]; $state['revision']++;
            $this->write($state); return $this->overview();
        });
    }
    public function saveClient(array $body, ?string $id=null): array {
        return $this->locked(function() use ($body,$id): array {
            $state=$this->state(); $old=$id!==null?($state['clients'][$id]??null):null;
            if ($id!==null && !$old) calendar_fail('client_not_found',404);
            if (!$old && count($state['clients'])>=5000) calendar_fail('client_limit',409);
            if ($old && ($body['revision']??null)!==$old['revision']) calendar_fail('revision_conflict',409,'Клиент изменён. Обновите список.');
            if (!is_string($body['name'] ?? null) || !is_string($body['email'] ?? null) || !is_string($body['planId'] ?? null) || (isset($body['enabled']) && !is_bool($body['enabled']))) calendar_fail('invalid_client',400);
            $name=trim((string)($body['name']??'')); $email=trim((string)($body['email']??'')); $planId=$body['planId']??'';
            if ($name==='' || strlen($name)>160 || strlen($email)>254 || !filter_var($email,FILTER_VALIDATE_EMAIL)) calendar_fail('invalid_client',400);
            if (!in_array($planId,array_column($state['plans'],'id'),true)) calendar_fail('invalid_plan',400);
            $expires=$body['expiresAt']??null;
            if ($expires!==null && (!is_string($expires) || !preg_match('/^\d{4}-\d{2}-\d{2}$/',$expires) || !checkdate((int)substr($expires,5,2),(int)substr($expires,8,2),(int)substr($expires,0,4)))) calendar_fail('invalid_expiry',400);
            $id??=calendar_uuid();
            $client=array_merge($old??[],['id'=>$id,'name'=>$name,'email'=>$email,'planId'=>$planId,'enabled'=>($body['enabled']??true)===true,
                'expiresAt'=>$expires,'createdAt'=>$old['createdAt']??calendar_now(),'revision'=>($old['revision']??0)+1]);
            $key=null;
            if (!$old) { $key='cal_'.bin2hex(random_bytes(32)); $client['keyHash']=hash('sha256',$key); $client['keyPrefix']=substr($key,0,12); $client['keyCreatedAt']=calendar_now(); }
            $state['clients'][$id]=$client; $state['revision']++; $this->write($state);
            return ['client'=>$this->cleanClient($client),'key'=>$key];
        });
    }
    public function rotate(string $id, int $revision): array {
        return $this->locked(function() use ($id,$revision): array {
            $state=$this->state(); $client=$state['clients'][$id]??null;
            if (!$client) calendar_fail('client_not_found',404);
            if ($client['revision']!==$revision) calendar_fail('revision_conflict',409);
            $key='cal_'.bin2hex(random_bytes(32)); $client['keyHash']=hash('sha256',$key); $client['keyPrefix']=substr($key,0,12);
            $client['keyCreatedAt']=calendar_now(); $client['revision']++;
            $state['clients'][$id]=$client; $state['revision']++; $this->write($state);
            return ['client'=>$this->cleanClient($client),'key'=>$key];
        });
    }
    public function authorize(string $key, ?int $now=null): array {
        if (!preg_match('/^cal_[a-f0-9]{64}$/',$key)) calendar_fail('invalid_api_key',401,'Передайте действующий API-ключ в заголовке X-API-Key.');
        $now??=time();
        return $this->locked(function() use ($key,$now): array {
            $state=$this->state(); $client=null; $hash=hash('sha256',$key);
            foreach ($state['clients'] as $entry) if (hash_equals($entry['keyHash'],$hash)) { $client=$entry; break; }
            if (!$client) calendar_fail('invalid_api_key',401,'Недействительный API-ключ.');
            $plan=null; foreach ($state['plans'] as $entry) if ($entry['id']===$client['planId']) $plan=$entry;
            if (!$client['enabled'] || !$plan || !$plan['enabled']) calendar_fail('api_access_disabled',403,'Доступ клиента или тариф отключён.');
            if ($client['expiresAt']!==null && gmdate('Y-m-d',$now)>$client['expiresAt']) calendar_fail('api_key_expired',403,'Срок доступа истёк.');
            $windows=['minute'=>[gmdate('Y-m-d\TH:i',$now),$plan['perMinute'],60-$now%60],
                'day'=>[gmdate('Y-m-d',$now),$plan['perDay'],86400-$now%86400],
                'month'=>[gmdate('Y-m',$now),$plan['perMonth'],gmmktime(0,0,0,(int)gmdate('n',$now)+1,1,(int)gmdate('Y',$now))-$now]];
            $usage=$client['usage']??[];
            foreach ($windows as $name=>[$bucket,$limit,$retry]) {
                if (($usage[$name]['bucket']??null)!==$bucket) $usage[$name]=['bucket'=>$bucket,'count'=>0];
                if ($usage[$name]['count']>=$limit) { header('Retry-After: '.$retry); calendar_fail('api_'.$name.'_limit',429,'Лимит запросов исчерпан: '.$name); }
            }
            foreach ($windows as $name=>$_) $usage[$name]['count']++;
            $client['usage']=$usage; $client['totalRequests']=($client['totalRequests']??0)+1; $client['lastUsedAt']=gmdate('Y-m-d\TH:i:s.000\Z',$now);
            $state['clients'][$client['id']]=$client; $this->write($state);
            return ['planId'=>$plan['id'],'monthLimit'=>$plan['perMonth'],'monthRemaining'=>$plan['perMonth']-$usage['month']['count']];
        });
    }
}

function calendar_access_routes(CalendarStore $store, string $method, string $path): void {
    if ($path==='/v1/calendar-access/plans' && $method==='GET') api_response(200,(new CalendarApiAccessStore())->publicPlans());
    if ($path!=='/v1/admin/calendar-api' && !str_starts_with($path,'/v1/admin/calendar-api/')) return;
    if (api_owner($store)===null) calendar_fail('owner_required',403);
    $access=new CalendarApiAccessStore();
    if ($path==='/v1/admin/calendar-api' && $method==='GET') api_response(200,$access->overview());
    if ($path==='/v1/admin/calendar-api' && $method==='PUT') api_response(200,$access->configure(api_request_json(32768)));
    if ($path==='/v1/admin/calendar-api/clients' && $method==='POST') api_response(201,$access->saveClient(api_request_json(4096)));
    if (preg_match('#^/v1/admin/calendar-api/clients/([a-f0-9-]{36})(/rotate)?$#',$path,$m)) {
        $body=in_array($method,['PUT','POST'],true)?api_request_json(4096):[];
        if (empty($m[2]) && $method==='PUT') api_response(200,$access->saveClient($body,$m[1]));
        if (($m[2]??'')==='/rotate' && $method==='POST') api_response(200,$access->rotate($m[1],(int)($body['revision']??-1)));
    }
    calendar_fail('not_found',404);
}
