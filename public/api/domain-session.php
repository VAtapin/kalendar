<?php
declare(strict_types=1);

trait CalendarDomainSessions {
    public function domainSession(string $action, array $body, string $origin, string $binding, string $account, string $admin): array {
        $aliases=['https://kalender.georg-kloster.ru','https://kalender.georg-kloster.de'];
        if(!in_array($origin,$aliases,true))calendar_fail('invalid_origin',403);
        return calendar_with_lock($this->locksDirectory,'domain-session',function()use($action,$body,$origin,$binding,$account,$admin,$aliases):array{
            $file=$this->dataDirectory.'/domain-sessions.json';
            $flows=calendar_read_json_file($file,[]);
            $flows=array_filter($flows,static fn($flow)=>($flow['expires']??0)>time());
            if($action==='create'){
                $target=$body['target']??'';$path=$body['path']??'/';
                if(!in_array($target,$aliases,true)||$target===$origin||!is_string($path)||strlen($path)>2048||!preg_match('#^/(?!/)[a-zA-Z0-9/_-]*$#D',$path))calendar_fail('invalid_target',400);
                if(!$this->accountUser($account)&&!$this->adminAuthenticated($admin))return ['url'=>$target.$path];
                if(count($flows)>=1000)calendar_fail('session_busy',429);
                $id=calendar_token();$nonce=calendar_token();
                $flows[calendar_hash($id)]=['source'=>$origin,'target'=>$target,'path'=>$path,'sourceBinding'=>calendar_hash($nonce),'expires'=>time()+120,'phase'=>'created'];
                calendar_atomic_json_write($file,$flows);
                return ['binding'=>$nonce,'url'=>$target.'/#session-bind='.rawurlencode($id)];
            }
            $id=$body['id']??'';
            if(!is_string($id)||strlen($id)>200)calendar_fail('invalid_session_transfer',400);
            $key=calendar_hash($id);$flow=$flows[$key]??null;
            if(!$flow)calendar_fail('expired_session_transfer',410);
            $nonce=null;
            if($action==='bind'){
                if($origin!==$flow['target']||$flow['phase']!=='created')calendar_fail('invalid_session_transfer',403);
                $nonce=calendar_token();$flow['targetBinding']=calendar_hash($nonce);$flow['phase']='bound';
                $result=['binding'=>$nonce,'url'=>$flow['source'].'/#session-authorize='.rawurlencode($id)];
            }elseif($action==='authorize'){
                if($origin!==$flow['source']||$flow['phase']!=='bound'||!hash_equals($flow['sourceBinding'],calendar_hash($binding)))calendar_fail('invalid_session_transfer',403);
                $flow['account']=$this->accountUser($account)?$account:'';
                $flow['admin']=$this->adminAuthenticated($admin)?$admin:'';
                $flow['phase']='authorized';
                $result=['url'=>$flow['target'].'/#session-redeem='.rawurlencode($id)];
            }elseif($action==='redeem'){
                if($origin!==$flow['target']||$flow['phase']!=='authorized'||!hash_equals($flow['targetBinding'],calendar_hash($binding)))calendar_fail('invalid_session_transfer',403);
                unset($flows[$key]);calendar_atomic_json_write($file,$flows);
                return ['url'=>$flow['target'].$flow['path'],
                    'account'=>$this->accountUser($flow['account'])?$flow['account']:'',
                    'admin'=>$this->adminAuthenticated($flow['admin'])?$flow['admin']:''];
            }else{calendar_fail('invalid_session_transfer',400);}
            $flows[$key]=$flow;calendar_atomic_json_write($file,$flows);return $result;
        });
    }
}
function calendar_domain_session_routes(CalendarStore $store,string $method,string $path):void{
    if(!str_starts_with($path,'/v1/domain-session/'))return;
    if($method!=='POST')calendar_fail('method_not_allowed',405);
    calendar_admin_check_origin();
    $origin=(string)($_SERVER['HTTP_ORIGIN']??'');
    // Origin must also match the host receiving the cookie, not just an alias.
    if($origin!=='https://'.($_SERVER['HTTP_HOST']??''))calendar_fail('invalid_origin',403);
    $action=substr($path,strlen('/v1/domain-session/'));
    $cookie=$action==='authorize'?'calendar_transfer_source':'calendar_transfer_target';
    $result=$store->domainSession($action,api_request_json(4096),$origin,(string)($_COOKIE[$cookie]??''),calendar_account_token(),calendar_admin_cookie_token());
    if(isset($result['binding'])){
        setcookie($action==='create'?'calendar_transfer_source':'calendar_transfer_target',$result['binding'],['expires'=>time()+120,'path'=>'/api','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);unset($result['binding']);
    }
    if($action==='redeem'){
        calendar_account_cookie($result['account']);
        calendar_admin_cookie($result['admin']);
        unset($result['account'],$result['admin']);
    }
    api_response(200,$result);
}
