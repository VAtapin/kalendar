<?php
declare(strict_types=1);
function calendar_icon_preview_routes(string $method,string $path): void {
    if(!in_array(rtrim($path,'/'),['/v1/calendar-icons/preview','/v1/icons/mother-of-god'],true))return;
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
    header('Access-Control-Allow-Headers: Accept, If-None-Match');
    if($method==='OPTIONS'){http_response_code(204);exit;}
    if(!in_array($method,['GET','HEAD'],true))calendar_fail('method_not_allowed',405);
    if($_GET)calendar_fail('invalid_parameter',400);
    $library=calendar_read_json_file(dirname(__DIR__).'/data/icon-preview.json',null);
    if(!is_array($library))calendar_fail('icon_preview_unavailable',503);
    calendar_public_response($library,$method);
}
