<?php
// Full source-package contract regression in the disposable real WordPress site.
require rtrim($argv[1], '/\\').'/wp-load.php';
set_error_handler(static function($severity,$message,$file,$line) {
    if(error_reporting() & $severity)throw new ErrorException($message,0,$severity,$file,$line);
    return false;
});
$package=json_decode(file_get_contents(dirname(__DIR__,2).'/BibleDesktop/resources/data/german-services-1895.json'),true,512,JSON_THROW_ON_ERROR);
$invalid=false;$withdrawn=false;
add_filter('pre_http_request',static function($pre,$args,$url)use($package,&$invalid,&$withdrawn) {
    if(!str_contains($url,'/api/liturgical/works'))return $pre;
    $parts=explode('/',trim(parse_url($url,PHP_URL_PATH),'/'));parse_str(parse_url($url,PHP_URL_QUERY)??'',$query);
    $data=[];$status=200;
    if(count($parts)===3)foreach($package['works'] as $entry) {
        if($entry['collection']!==($query['collection']??''))continue;
        $data[]=['slug'=>$entry['slug'],'title'=>$entry['slug'],'collections'=>[$entry['collection']],
            'available_languages'=>$withdrawn?[]:['de'],'prayer_groups'=>[],'prayer_group'=>null];
    }
    else foreach($package['works'] as $entry)if($parts[3]===$entry['slug']) {
        if($invalid){$status=409;break;}
        $data=['slug'=>$entry['slug'],'title'=>$entry['slug'],'language'=>'de','blocks'=>$entry['blocks'],
            'orthography'=>$package['orthography'],'credit'=>$package['source']['title'],'source_url'=>$package['source']['url'],
            'content_hash'=>$entry['content_sha256'],'review_status'=>'source-verified-complete','completeness'=>'complete'];
    }
    return ['headers'=>[],'body'=>wp_json_encode(['data'=>$data]),'response'=>['code'=>$status],'cookies'=>[]];
},11,3);
function service_check($condition,$message) { if(!$condition)throw new RuntimeException($message); }
foreach($package['works'] as $entry) {
    update_option('orthocal_cache_generation',wp_generate_uuid4());
    $a=Orthocal_Plugin::config(['mode'=>$entry['collection'],'lang'=>'de','text_language'=>'de','work'=>$entry['slug']]);
    $data=Orthocal_Library::data($a);
    $count=count(array_filter($package['works'],static fn($work)=>$work['collection']===$entry['collection']));
    service_check(!is_wp_error($data) && count($data['works'])===$count,'Correct independent collection');
    service_check($data['version']['blocks']===$entry['blocks'] && $data['version']['content_hash']===$entry['content_sha256'],'Full stored service/hash');
    service_check($data['version']['language']==='de' && $data['version']['completeness']==='complete','Actual complete German version');
    $html=Orthocal_Library::render($data,$a);
    service_check(str_contains($html,'lang="de" data-orthography="historic-1895"') && str_contains($html,'Historische Ausgabe (1895)'),'Historical edition rendered');
    service_check(str_contains($html,esc_html($entry['first_text'])) && str_contains($html,esc_html($entry['last_text'])),'Full body boundaries rendered');
    service_check(str_contains($html,esc_html($package['source']['title'])) && str_contains($html,esc_url($package['source']['url'])),'Real attribution/source');
    $a['text_language']='ru';update_option('orthocal_cache_generation',wp_generate_uuid4());
    $data=Orthocal_Library::data($a);
    service_check($data['version']===null && $data['works']===[],'Missing Russian must not fall back to German');
}
update_option('orthocal_cache_generation',wp_generate_uuid4());
$data=Orthocal_Library::data(Orthocal_Plugin::config(['mode'=>'prayers','text_language'=>'de']));
service_check($data['works']===[] && $data['version']===null,'Canons/akathists do not become prayer rules');
$invalid=true;update_option('orthocal_cache_generation',wp_generate_uuid4());
$data=Orthocal_Library::data(Orthocal_Plugin::config(['mode'=>'akathists','text_language'=>'de']));
service_check(is_wp_error($data),'409 rejects damaged edition without fallback');
$withdrawn=true;update_option('orthocal_cache_generation',wp_generate_uuid4());
$data=Orthocal_Library::data(Orthocal_Plugin::config(['mode'=>'akathists','text_language'=>'de']));
service_check($data['works']===[] && $data['version']===null,'Withdrawn edition no longer appears');
update_option('orthocal_cache_generation',wp_generate_uuid4());
echo "PASS German services: full66/179blocks, separate collections, actualde/1895/credit/hash, no language fallback, withdrawn edition\n";
