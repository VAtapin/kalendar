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
foreach (['ru', 'cu-civil', 'cu'] as $language) {
    $full=calendar_service_expansions('full', $language);
    if(count($full)!==7||strlen($full[0]['text'])<100||($full[0]['language'] ?? null)!==$language)throw new Exception('Missing localized full prayers: '.$language);
}
if(substr_count(calendar_service_expansion('come-worship', 'full', 'cu')['text'], 'цр҃е́ви') !== 3)throw new Exception('Traditional full form lost Ponomar spelling');
if(calendar_service_expansion('come-worship', 'full', 'ru')['text'] === calendar_service_expansion('come-worship', 'full', 'cu-civil')['text'])throw new Exception('Russian and civil editions were conflated');
if(str_contains(calendar_service_expansions('full', 'ru')[6]['text'], "`n"))throw new Exception('Lord have mercy count was expanded into repeated lines');
foreach (['ru', 'cu-civil', 'cu'] as $language) {
    $rules=calendar_service_reader_rules($language, 'full');
    if(!$rules['rubricPrefixes']||!$rules['inlineRubrics']||count($rules['transforms'])<2)throw new Exception('Missing structured reader rules: '.$language);
}
$civilShort=calendar_service_reader_rules('cu-civil', 'short');
if(count($civilShort['hiddenWhenShort'])!==2||count($civilShort['transforms'])!==1)throw new Exception('Civic short reader rules missing');echo "PASS service: all seven weekdays, reviewed assignments, three localized full forms, no repeated Lord-have-mercy lines\n";
