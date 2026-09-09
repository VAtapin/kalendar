<?php
declare(strict_types=1);
require __DIR__.'/../public/api/calendar-service.php';
set_error_handler(static function($severity,$message,$file,$line) { throw new ErrorException($message,0,$severity,$file,$line); });
$library=json_decode(file_get_contents(__DIR__.'/../public/data/liturgical-texts.json'),true,512,JSON_THROW_ON_ERROR);
foreach ([0=>2,1=>2,2=>2,3=>2,4=>4,5=>2,6=>4] as $weekday=>$count) {
    $rows=calendar_service_assignments($library,$weekday,6,'unused-subject');
    if(count($rows)!==$count)throw new Exception('Missing weekday assignments: '.$weekday);
    foreach($rows as $row)if(!$row['text']||!$row['sources']||!in_array($row['slot'],['troparion-of-day','kontakion-of-day'],true))throw new Exception('Invalid assignment');
}
$thursday=array_column(calendar_service_assignments($library,4,6,'apostles'),'subject');
if(!in_array('nicholas',$thursday,true)||!in_array('apostles',$thursday,true))throw new Exception('Thursday must retain both subjects');
$saturday=array_column(calendar_service_assignments($library,6,6,'all-saints'),'subject');
if(!in_array('departed',$saturday,true))throw new Exception('Saturday lost departed');
// Great Friday is still a weekly reference, never a verified feast proper.
// Date-specific Royal Hours texts are not present in this reviewed corpus.
$greatFriday=new DateTimeImmutable('2026-04-10');
$rows=calendar_service_assignments($library,(int)$greatFriday->format('w'),6,'cross');
if(array_unique(array_column($rows,'subject'))!==['cross'])throw new Exception('Friday incorrectly assigns Nicholas');
if(array_filter($rows,static fn($r)=>!str_starts_with($r['textId'],'weekday-')))throw new Exception('Invented Great Friday proper');
$full=calendar_service_expansions('full');
if(count($full)!==7||strlen($full[0]['text'])<100)throw new Exception('Missing full prayers');
echo "PASS service: all seven weekdays, Thursday/Saturday pairs, Friday cross, no invented Great Friday proper, full prayers\n";
