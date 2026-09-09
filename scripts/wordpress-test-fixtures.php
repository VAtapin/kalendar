<?php
// Installed only in the disposable local test site. Never packaged in the plugin.
add_filter('pre_http_request', function($pre,$args,$url) {
    if(str_starts_with($url,'https://kalender.georg-kloster.ru/api/v1/calendar-texts/')) {
        $value=json_decode(file_get_contents(ORTHOCAL_TEST_ASSET_ROOT.'/data/liturgical-texts.json'),true);
        parse_str(parse_url($url,PHP_URL_QUERY)??'',$query);
        $value['texts']=array_values(array_filter($value['texts'],static function($text)use($query){
            foreach(['id','type','scope','language'] as $field)if(isset($query[$field])&&$query[$field]!==''&&$text[$field]!==$query[$field])return false;
            if(isset($query['tone'])&&$text['tone']!==(int)$query['tone'])return false;
            if(isset($query['weekday'])&&!in_array((int)$query['weekday'],$text['weekdays'],true))return false;
            return true;
        }));
        $value['count']=count($value['texts']);$value['assignment']='reference-only';
        return ['headers'=>['x-calendar-application-cache-ttl'=>'300'],'body'=>wp_json_encode($value),'response'=>['code'=>200,'message'=>'OK'],'cookies'=>[]];
    }
    if(str_starts_with($url,'https://kalender.georg-kloster.ru/assets/')||$url==='https://kalender.georg-kloster.ru/calendar-api-font.php') {
        if(isset($args['headers']['X-API-Key']))throw new Exception('Key sent to static media');
        $path=parse_url($url,PHP_URL_PATH);$file=ORTHOCAL_TEST_ASSET_ROOT.($path==='/calendar-api-font.php'?'/fonts/MonomakhUnicode.ttf':$path);
        if(!is_file($file))return new WP_Error('fixture_missing','Missing media fixture');
        $body=file_get_contents($file);$etag='"'.hash('sha256',$body).'"';$same=($args['headers']['If-None-Match']??'')===$etag;
        return ['headers'=>['etag'=>$etag,'last-modified'=>'Wed, 09 Sep 2026 00:00:00 GMT'],'body'=>$same?'':$body,'response'=>['code'=>$same?304:200,'message'=>'OK'],'cookies'=>[]];
    }
    if (!str_starts_with($url,'https://kalender.georg-kloster.ru/api/v1/calendar/') && !str_starts_with($url,'https://bible-desktop.com/api/')) return new WP_Error('offline_test','External requests disabled in test');
    $calendar=str_contains($url,'kalender.georg');
    if (!$calendar && isset($args['headers']['X-API-Key'])) throw new Exception('Calendar key leaked to Bible');
    $path=parse_url($url,PHP_URL_PATH);parse_str(parse_url($url,PHP_URL_QUERY)??'',$q);
    $status=200;
    if ($calendar) {
        $year=json_decode(file_get_contents(WP_CONTENT_DIR.'/calendar-fixture.json'),true);
        $action=basename($path);
        if ($action==='day'||$action==='today') {
            $date=$q['date']??'2027-05-02'; $days=array_values(array_filter($year['days'],static fn($d)=>$d['date']===$date));
            $value=['metadata'=>$year['metadata'],'day'=>$days[0]??$year['days'][0]];
        } elseif($action==='upcoming') {
            $items=[];foreach($year['days'] as $day) foreach($day['events'] as $e) if($day['date']>=($q['date']??'2027-01-01')&&$e['category']==='commemoration'&&$e['typeCode']<=2) $items[]=['date'=>$day['date'],'oldStyleDate'=>$day['oldStyleDate'],'event'=>$e];
            $value=['items'=>array_slice($items,0,(int)($q['limit']??5))];
        } else {
            $value=$year; if($action==='month') $value['days']=array_values(array_filter($year['days'],static fn($d)=>(int)substr($d['date'],5,2)===(int)$q['month']));
            if(($q['view']??'')==='summary') $value['days']=array_map(static function($day) {
                $result=array_intersect_key($day,array_flip(['date','oldStyleDate','weekday','weekdayName','dayStyle','foodLabel','fastingColor','eventCount']));
                $result['events']=array_map(static fn($e)=>array_intersect_key($e,array_flip(['id','title','typeCode','category','typikonMark'])),array_values(array_filter($day['events'],static fn($e)=>$e['category']==='commemoration')));
                return $result;
            },$value['days']);
        }
    } else {
        $parts=explode('/',trim($path,'/'));$code=$parts[2]??'test-ru';
        $translation=['code'=>$code,'name'=>'Тестовый перевод','language'=>['code'=>$code==='test-missing'?'de':'ru']];
        if(count($parts)===2) $value=[['code'=>'test-ru','name'=>'Тестовый русский','language'=>['code'=>'ru']],['code'=>'test-missing','name'=>'Неполный перевод','language'=>['code'=>'de']]];
        elseif(count($parts)===4) {
            $value=['translation'=>$translation,'books'=>array_map(static fn($osis)=>['slug'=>strtolower($osis),'canonical_book'=>['osis_code'=>$osis],'chapters_count'=>150],['Acts','John','Luke','Mark','Matt','Ps','1Cor','2Cor','Rom'])];
        } else {
            $chapter=(int)end($parts);$value=['translation'=>$translation,'book'=>['slug'=>$parts[4]],'chapter'=>['number'=>$chapter],'verses'=>[]];
            for($n=1;$n<=180;$n++) if($code!=='test-missing'||$n!==2) $value['verses'][]=['number'=>$n,'plain_text'=>'Тестовый стих '.$n.'. Текст получен через отдельный API.'];
        }
    }
    return ['headers'=>['x-calendar-application-cache-ttl'=>$calendar?'300':'0'],'body'=>wp_json_encode($value),'response'=>['code'=>$status,'message'=>'OK'],'cookies'=>[]];
},10,3);
