<?php
// Focused renderer fixture. The full WordPress integration suite remains separate.
define('ABSPATH',__DIR__);
function esc_html($s){return htmlspecialchars((string)$s,ENT_QUOTES,'UTF-8');}
function esc_attr($s){return esc_html($s);}
function esc_url($s){return esc_html($s);}
function wp_json_encode($v){return json_encode($v,JSON_UNESCAPED_UNICODE);}
function selected($a,$b,$echo=false){return $a===$b?'selected':'';}
function wp_date($f){return date($f,strtotime('2026-09-09'));}
function wp_parse_args($a,$b){return array_merge($b,$a);}
function get_option($name,$default=[]){return $default;}
require __DIR__.'/../wordpress/orthocal/includes/plugin.php';
require __DIR__.'/../public/api/calendar-service.php';
$lang=$argv[1]??'de';$mode=$argv[2]??'day';$office=$argv[3]??'horologion';
$a=Orthocal_Plugin::options()+['mode'=>$mode,'date'=>'2026-09-09','scope'=>'','tone'=>''];
$a['text_language']=$argv[4]??'';$a['work']=$argv[5]??'';$a['text_page']='1';
$a['lang']=$lang;$a['office']=$office;$a['images']='0';$a['sections']='fasting,readings,texts';$a['show_copy']='0';
$a['endpoint']='https://reader.test/api/';$a['liveDate']=false;$a['ui']=Orthocal_Plugin::ui_catalog($lang);
$day=['date'=>'2026-09-09','oldStyleDate'=>'2026-08-27','weekAfterPentecost'=>15,'tone'=>6,'foodLabel'=>'Trockenkost','events'=>[['category'=>'scripture-reading','title'=>'Mk 6:7-13','reading'=>null]]];
$corpus=json_decode(file_get_contents(__DIR__.'/fixtures/liturgical-reader.json'),true);
$language=Orthocal_Library::language($a);$works=[];$version=null;
foreach($corpus['works'] as $work) {
    if(!in_array('horologion',$work['collections'],true)||!isset($work['versions'][$language==='cu-civil'?'cu':$language]))continue;
    $works[]=['slug'=>$work['slug'],'title'=>$work['title']];
}
$slug=$a['work']?:'chas-shestoj';
foreach($corpus['works'] as $work)if($work['slug']===$slug && isset($work['versions'][$language==='cu-civil'?'cu':$language]))$version=['slug'=>$slug,'title'=>$work['title'],'language'=>$language,'orthography'=>'civil','blocks'=>$work['versions'][$language==='cu-civil'?'cu':$language],'source_url'=>$work['url'],'credit'=>'Азбука веры'];
$body=$mode==='day'?Orthocal_Plugin::day($day,$a):Orthocal_Library::render(['library'=>true,'works'=>$works,'version'=>$version,'language'=>$language],$a);
echo '<section class="orthocal oc-theme-book" data-orthocal="'.esc_attr(wp_json_encode($a)).'"><div class="oc-heading">'.esc_html(Orthocal_Plugin::ui('Календарная мастерская',$lang)).'</div>'.$body.'<p class="oc-status" role="status"></p></section>';
