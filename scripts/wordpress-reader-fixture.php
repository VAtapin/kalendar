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
$a['lang']=$lang;$a['office']=$office;$a['images']='0';$a['sections']='fasting,readings,texts';$a['show_copy']='0';
$a['endpoint']='https://reader.test/api/';$a['liveDate']=false;$a['ui']=Orthocal_Plugin::ui_catalog($lang);
$day=['date'=>'2026-09-09','oldStyleDate'=>'2026-08-27','weekAfterPentecost'=>15,'tone'=>6,'foodLabel'=>'Trockenkost','events'=>[['category'=>'scripture-reading','title'=>'Mk 6:7-13','reading'=>null]]];
$library=json_decode(file_get_contents(__DIR__.'/../public/data/liturgical-texts.json'),true);
$data=['date'=>$a['date'],'office'=>$office,'assignments'=>calendar_service_assignments($library,3,6,'cross'),'expansions'=>calendar_service_expansions('full',$lang)];
if ($data['assignments']) { $data['assignments'][0]['insert']=true; $data['assignments'][0]['rubric']='Слава:'; }
$data['properCoverage']=['status'=>'partial'];
$body=$mode==='day'?Orthocal_Plugin::day($day,$a):Orthocal_Plugin::service($data,$a);
echo '<section class="orthocal oc-theme-book" data-orthocal="'.esc_attr(wp_json_encode($a)).'"><div class="oc-heading">'.esc_html(Orthocal_Plugin::ui('Календарная мастерская',$lang)).'</div>'.$body.'<p class="oc-status" role="status"></p></section>';
