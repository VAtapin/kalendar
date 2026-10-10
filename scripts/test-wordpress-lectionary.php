<?php
// Run in the disposable real WordPress site; source cases come from the reviewed package.
require rtrim($argv[1], '/\\').'/wp-load.php';
set_error_handler(static function($severity,$message,$file,$line) {
    if(error_reporting() & $severity)throw new ErrorException($message,0,$severity,$file,$line);
    return false;
});
function lection_check($condition,$message) { if(!$condition)throw new RuntimeException($message); }
$catalog=json_decode(file_get_contents(dirname(__DIR__,2).'/BibleDesktop/resources/data/lectionary-catalog.json'),true,512,JSON_THROW_ON_ERROR);
$entries=array_values(array_filter($catalog['entries'],static fn($entry)=>$entry['book']==='Luke' && $entry['number']===19 && $entry['status']==='source-transcribed'));
lection_check(count($entries)>0,'Real Luke 19 source exists');
$candidates=array_map(static fn($entry)=>array_intersect_key($entry,array_flip(['id','kind','book','number','source_variant','reference','source_url'])),$entries);
$reading=['parseStatus'=>'parsed','numbering'=>'unknown','passages'=>$entries[0]['passages'],
    'lectionary'=>['status'=>'exact-reference-match','basis'=>'exact-source-coordinates','translation_mapping_verified'=>false,'candidates'=>$candidates]];
$result=Orthocal_Lectionary::presentation($reading,'ru');
lection_check($result['label']===' · Зачало 19','Unique base number');
lection_check(substr_count($result['details'],'<li>')===count($candidates),'All source variants preserved');
lection_check(str_contains($result['details'],esc_url($entries[0]['source_url'])),'Real source link preserved');
lection_check(str_contains($result['details'],'других переводов отдельно не проверена'),'No universal translation mapping claim');
lection_check(Orthocal_Lectionary::presentation($reading,'de')['label']===' · Perikope 19','Localized label');
$reading['lectionary']['candidates']=[array_replace($candidates[0],['source_variant'=>'А']),array_replace($candidates[0],['source_variant'=>'Б'])];
$result=Orthocal_Lectionary::presentation($reading,'ru');
lection_check($result['label']===' · Зачало 19' && str_contains($result['details'],'(А)') && str_contains($result['details'],'(Б)'),'Source variants retain one base number');
$reading['lectionary']['candidates']=$candidates;
$reading['lectionary']['status']='ambiguous';
$reading['lectionary']['candidates'][]=array_replace($candidates[0],['book'=>'John','number'=>19,'reference'=>'Ин.5:17–24']);
$result=Orthocal_Lectionary::presentation($reading,'ru');
lection_check($result['label']==='' && substr_count($result['details'],'<li>')===count($candidates)+1,'Ambiguous books are not collapsed by number');
$reading['lectionary']['status']='exact-reference-match';
lection_check(Orthocal_Lectionary::presentation($reading,'ru')['label']==='','Conflicting exact response cannot choose first');
foreach(['unmatched','unknown'] as $status) {
    $reading['lectionary']['status']=$status;
    lection_check(Orthocal_Lectionary::presentation($reading,'ru')===['label'=>'','details'=>''],'No guessed number');
}
lection_check(Orthocal_Lectionary::presentation(null,'ru')===['label'=>'','details'=>''],'Old API supported');
$reading['lectionary']['status']='exact-reference-match';$reading['lectionary']['candidates']=[$candidates[0]];
$reading['lectionary']['candidates'][0]['reference']='<script>alert(1)</script>';
lection_check(!str_contains(Orthocal_Lectionary::presentation($reading,'ru')['details'],'<script>'),'Source content is escaped');
$reading['lectionary']['candidates'][0]['number']=[];
lection_check(Orthocal_Lectionary::presentation($reading,'ru')['label']==='','Malformed number ignored without warning');
$reading['lectionary']['candidates'][]=$candidates[0];
lection_check(Orthocal_Lectionary::presentation($reading,'ru')['label']==='','Malformed candidate cannot reduce ambiguity');
$reading['lectionary']['basis']='partial';
lection_check(Orthocal_Lectionary::presentation($reading,'ru')['details']==='','Partial match cannot assign number');
// Exercise the real day renderer without requiring new fields from old providers.
$reading['lectionary']['basis']='exact-source-coordinates';$reading['lectionary']['candidates']=$candidates;
$a=Orthocal_Plugin::config(['mode'=>'readings','date'=>'2026-10-10']);
$day=['date'=>'2026-10-10','oldStyleDate'=>'2026-09-27','events'=>[['category'=>'scripture-reading','typeCode'=>207,'title'=>'Лк.5:17–26','reading'=>$reading]]];
$html=Orthocal_Plugin::day($day,$a);
lection_check(str_contains($html,'Лк.5:17–26 · Зачало 19'),'Number next to actual reference');
lection_check(str_contains($html,'&quot;translation_mapping_verified&quot;:false'),'Original reading contract retained in reader');
echo "PASS lectionary: unique/variant/ambiguous/unmatched/old API, actual source links, languages, escaping, reading renderer\n";
