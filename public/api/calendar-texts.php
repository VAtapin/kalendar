<?php
declare(strict_types=1);

/** Reference texts, deliberately separate from the assignment of services to dates. */
function calendar_texts_routes(string $method,string $path): void {
    if(!in_array($path,['/v1/calendar-texts','/v1/calendar-texts/'],true))return;
    header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
    header('Access-Control-Allow-Headers: Accept, X-API-Key, Authorization, If-None-Match');
    if($method==='OPTIONS'){http_response_code(204);exit;}
    if(!in_array($method,['GET','HEAD'],true))calendar_fail('method_not_allowed',405);
    $allowed=['id','type','scope','tone','weekday','language'];
    foreach($_GET as $key=>$value)if(!in_array($key,$allowed,true)||!is_string($value)||strlen($value)>100)calendar_fail('invalid_parameter',400);
    $type=$_GET['type']??'';$scope=$_GET['scope']??'';$tone=$_GET['tone']??'';$weekday=$_GET['weekday']??'';$language=$_GET['language']??'cu';
    if(!in_array($type,['','troparion','kontakion','prayer','magnification'],true)||!in_array($scope,['','resurrection','weekday','common'],true)||($tone!==''&&!preg_match('/^[1-8]$/D',$tone))||($weekday!==''&&!preg_match('/^[0-6]$/D',$weekday))||!preg_match('/^[a-z]{2,3}$/D',$language)||(!empty($_GET['id'])&&!preg_match('/^[a-z0-9-]{1,100}$/D',$_GET['id'])))calendar_fail('invalid_parameter',400);
    $key=api_header('X-API-Key');if($key==='')$key=api_bearer_token();
    $access=(new CalendarApiAccessStore())->authorize($key);
    if($access['monthLimit']!==null){header('X-API-Month-Limit: '.$access['monthLimit']);header('X-API-Month-Remaining: '.$access['monthRemaining']);}
    $file=dirname(__DIR__).'/data/liturgical-texts.json';
    $library=calendar_read_json_file($file,null);if(!is_array($library)||!isset($library['texts']))calendar_fail('text_library_unavailable',503);
    $texts=array_values(array_filter($library['texts'],static function($text)use($type,$scope,$tone,$weekday,$language){
        return (empty($_GET['id'])||$text['id']===$_GET['id'])&&($type===''||$text['type']===$type)&&($scope===''||$text['scope']===$scope)&&($tone===''||$text['tone']===(int)$tone)&&($weekday===''||in_array((int)$weekday,$text['weekdays'],true))&&$text['language']===$language;
    }));
    if(!empty($_GET['id'])&&!$texts)calendar_fail('text_not_found',404);
    // Editorial provenance and review state are administrative metadata. They
    // stay in the local source file but never cross the public API boundary.
    $texts=array_map(static function($text){if(!is_array($text))return $text;unset($text['review'],$text['note']);return $text;},$texts);
    calendar_public_response(['schemaVersion'=>1,'version'=>$library['version'],'contentHash'=>$library['contentHash'],'assignment'=>'reference-only','language'=>$language,'count'=>count($texts),'texts'=>$texts],$method);
}
