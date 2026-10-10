<?php
// Contract regression in the disposable real WordPress installation.
require rtrim($argv[1], '/\\').'/wp-load.php';
set_error_handler(static function($severity,$message,$file,$line) {
    if(error_reporting() & $severity)throw new ErrorException($message,0,$severity,$file,$line);
    return false;
});
$package=json_decode(file_get_contents(dirname(__DIR__,2).'/BibleDesktop/resources/data/prayer-catalog.json'),true,512,JSON_THROW_ON_ERROR);
$works=[];$versions=[];$revision='revision-one';$requestedUrls=[];
foreach($package['works'] as $index=>$entry) {
    $slug=$entry['slug'];
    $works[$slug]=['id'=>$index+1,'slug'=>$slug,'title'=>$entry['title'],'prayer_group'=>$entry['group'],
        'prayer_groups'=>$slug==='prayer-lords'?['short','occasions']:[$entry['group']],
        'legacy_slugs'=>['prayer-'.($index+100)],'available_languages'=>[$entry['language']],
        'content_revision'=>$revision,'visible'=>$entry['visible']];
    $versions[$slug]=['slug'=>$slug,'title'=>$entry['title'],'language'=>$entry['language'],
        'blocks'=>$entry['blocks'],'source_url'=>'https://azbyka.ru/molitvoslov/','credit'=>'Азбука веры'];
}
add_filter('pre_http_request',static function($pre,$args,$url)use(&$works,&$versions,&$requestedUrls) {
    if(!str_contains($url,'/api/liturgical/works'))return $pre;
    $requestedUrls[]=$url;
    $parts=explode('/',trim(parse_url($url,PHP_URL_PATH),'/'));
    if(count($parts)===3) {
        $value=array_values(array_filter($works,static fn($work)=>$work['visible']));
        $value[]=$value[0]; // A repeated card must still have one identity.
    } else {
        $slug=$parts[3];
        foreach($works as $work)if(in_array($slug,$work['legacy_slugs'],true))$slug=$work['slug'];
        if(!isset($works[$slug]))return ['headers'=>[],'body'=>'{}','response'=>['code'=>404],'cookies'=>[]];
        $value=count($parts)===4?$works[$slug]:$versions[$slug];
    }
    return ['headers'=>[],'body'=>wp_json_encode(['data'=>$value]),'response'=>['code'=>200],'cookies'=>[]];
},11,3);
function prayer_check($condition,$message) { if(!$condition)throw new RuntimeException($message); }
function prayer_data($attrs=[]) {
    update_option('orthocal_cache_generation',wp_generate_uuid4());
    return Orthocal_Library::data(Orthocal_Plugin::config(['mode'=>'prayers','lang'=>'ru']+$attrs));
}
$data=prayer_data();
prayer_check($data['language']==='cu-civil','Default uses the largest actual edition');
prayer_check(count($data['works'])===20,'20 visible Slavonic works, with no duplicate');
$rules=prayer_data(['prayer_group'=>'rules']);
prayer_check(count($rules['works'])===4,'Four complete rules');
foreach($rules['works'] as $work)prayer_check($work['prayer_groups']===['rules'],'Rules filter');
foreach(['short','occasions'] as $group) {
    $data=prayer_data(['prayer_group'=>$group]);
    prayer_check(count(array_filter($data['works'],static fn($work)=>$work['slug']==='prayer-lords'))===1,'Lord’s Prayer has one identity in each use');
}
foreach($works as $slug=>$work) {
    $data=prayer_data(['work'=>$work['legacy_slugs'][0]]);
    prayer_check($data['version']['slug']===$slug,'Legacy link resolves '.$slug);
    prayer_check($data['version']['blocks']===$versions[$slug]['blocks'],'Legacy link returns all blocks '.$slug);
    prayer_check($data['language']===$versions[$slug]['language'],'Legacy link chooses actual edition '.$slug);
}
foreach(['de','cu'] as $language) {
    $data=prayer_data(['text_language'=>$language]);
    prayer_check($data['version']===null && $data['works']===[],'Absent language is never replaced');
    $a=Orthocal_Plugin::config(['mode'=>'prayers','lang'=>'de','text_language'=>$language]);
    $html=Orthocal_Library::render($data,$a);
    prayer_check((bool)preg_match('/value="'.$language.'"\s+selected/',$html),'Unavailable requested language remains selected');
    prayer_check(!str_contains($html,'oc-library-content'),'No foreign-language fallback body');
    if($language==='de')prayer_check(str_contains($html,'https://orthodoxia.de/gebete/gebetbuch'),'German is an external source');
}
prayer_check(is_wp_error(Orthocal_Plugin::config(['prayer_group'=>'invalid'])),'Unknown group rejected');
$data=prayer_data(['work'=>'prayer-99999']);
prayer_check(is_wp_error($data),'Unreviewed legacy link remains unavailable');
// Keep the cached version of the old revision; changing the work revision must
// fetch a new body even inside the same request memoization window.
$data=prayer_data(['work'=>'prayer-morning-rule']);
$oldVersion=$data['version'];
$works['prayer-morning-rule']['content_revision']='revision-two';
$versions['prayer-morning-rule']['blocks'][]=['id'=>'revision-test','kind'=>'text','text'=>'New reviewed revision'];
$generation=wp_generate_uuid4();update_option('orthocal_cache_generation',$generation);
$origin=rtrim(Orthocal_Config::public_api_url('/api/'),'/');
$versionUrl=$origin.'/liturgical/works/prayer-morning-rule/versions/cu-civil';
foreach([$versionUrl,add_query_arg(['content_revision'=>'revision-one'],$versionUrl)] as $url) {
    $cache='orthocal_response_'.md5(Orthocal_Plugin::VERSION.'|'.$url.'|'.Orthocal_Plugin::key().'|'.$generation);
    set_transient($cache,['data'=>$oldVersion],300);
}
$data=Orthocal_Library::data(Orthocal_Plugin::config(['mode'=>'prayers','work'=>'prayer-morning-rule']));
prayer_check(end($data['version']['blocks'])['text']==='New reviewed revision','New revision bypasses cached old body');
prayer_check(count(array_filter($requestedUrls,static fn($url)=>str_contains($url,'content_revision=revision-two')))===1,'Revision is part of version cache identity');
echo "PASS prayer catalogue: 24 legacy links/full bodies, 21 visible identities, groups, actual languages, external German source, revision cache\n";
