<?php
require __DIR__.'/../public/api/lib.php';
$s=new CalendarStore(sys_get_temp_dir().'/video-test-'.bin2hex(random_bytes(6)));
$one=['id'=>calendar_uuid(),'title'=>'Первый','url'=>'https://youtu.be/abcdefghijk','duration'=>'1:20','enabled'=>true];
$two=['id'=>calendar_uuid(),'title'=>'Второй','url'=>'https://www.youtube.com/shorts/12345678901','duration'=>'','enabled'=>false];
$state=$s->saveVideoLessons(['revision'=>0,'items'=>[$one,$two]]);
if(count($s->videoLessons()['items'])!==1)throw new Exception('Hidden video leaked');
try{$s->saveVideoLessons(['revision'=>0,'items'=>[]]);throw new Exception('Conflict missing');}catch(ApiFailure $e){if($e->httpStatus!==409)throw $e;}
$one['url']='https://evil.example/watch?v=abcdefghijk';
try{$s->saveVideoLessons(['revision'=>1,'items'=>[$one]]);throw new Exception('Invalid URL accepted');}catch(ApiFailure $e){if($e->httpStatus!==400)throw $e;}
$state=$s->saveVideoLessons(['revision'=>1,'items'=>[$two,$state['items'][0]]]);
if($state['items'][0]['id']!==$two['id'])throw new Exception('Order lost');
$s->saveVideoLessons(['revision'=>2,'items'=>[]]);if($s->videoLessons()['items']!==[])throw new Exception('Delete failed');
echo "PASS: video publication, hidden entries, URLs, revisions, reorder, deletion\n";
