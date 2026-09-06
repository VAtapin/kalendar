<?php
declare(strict_types=1);
require __DIR__.'/../public/api/lib.php';
function check(bool $ok,string $message):void{if(!$ok)throw new RuntimeException($message);}
function rejects(callable $fn,string $code):void{try{$fn();throw new RuntimeException('Expected '.$code);}catch(ApiFailure $e){check($e->errorCode===$code,'Unexpected '.$e->errorCode);}}
$dir=sys_get_temp_dir().'/calendar-site-test-'.bin2hex(random_bytes(6));$store=new CalendarStore($dir);
$state=$store->sitePages(true);check(count($state['items'])===3,'Seeds');
$page=$state['items'][0];$old=$store->sitePages()['items'][0];$page['translations']['ru']['title']='Private draft';$page['slug']='draft-slug';$page['order']=99;
$state=$store->saveSitePage(['revision'=>0,'page'=>$page,'action'=>'draft']);
check($store->sitePages()['items'][0]===$old,'Draft content/slug/order leaked');
rejects(fn()=>$store->saveSitePage(['revision'=>0,'page'=>$page]),'revision_conflict');
rejects(fn()=>$store->saveSitePage(['revision'=>1,'page'=>$page,'action'=>'publish']),'review_required');
$state=$store->saveSitePage(['revision'=>1,'page'=>$page,'action'=>'publish','reviewed'=>true]);
check($store->sitePages()['items'][2]['slug']==='draft-slug','Publish slug');
check($store->sitePages()['items'][2]['translations']['ru']['title']==='Private draft','Publish text');
$state=$store->saveSitePage(['revision'=>2,'page'=>$page,'action'=>'unpublish']);check(count($store->sitePages()['items'])===2,'Unpublish');
$state=$store->saveSitePage(['revision'=>3,'page'=>$page,'action'=>'delete']);check(count($state['items'])===2,'Delete');
$bad=$page;$bad['slug']='../escape';rejects(fn()=>$store->saveSitePage(['revision'=>4,'page'=>$bad]),'invalid_page');
foreach(['javascript:alert(1)','data:text/html,test','https://user:secret@example.org/'] as $url)rejects(fn()=>calendar_content_blocks([['type'=>'button','text'=>'x','url'=>$url]]),'invalid_block_url');
check(calendar_content_blocks([['type'=>'text','text'=>'<script>alert(1)</script>','url'=>'']])[0]['text']==='<script>alert(1)</script>','Plain text preserved for escaped rendering');
$style=calendar_block_style(['align'=>'expression(alert(1))','fontSize'=>999,'color'=>'url(https://evil.example)','bold'=>true]);
check($style===['fontSize'=>48,'bold'=>true],'Style allowlist');
$html=calendar_newsletter_content([['type'=>'text','text'=>'Styled text','url'=>'','style'=>['color'=>'#123456','bold'=>true,'align'=>'center']]])['html'];
check(str_contains($html,'color:#123456')&&str_contains($html,'font-weight:bold')&&str_contains($html,'text-align:center'),'Email formatting persisted');
rejects(fn()=>$store->aiDraft(['approved'=>true]),'ai_not_configured');
$secret='sk-'.str_repeat('test',10);$settings=$store->aiSettings(['enabled'=>false,'model'=>'test-model','key'=>$secret]);
check($settings['hasKey'] && !str_contains(json_encode($settings),$secret),'Secret leaked');
$settings=$store->aiSettings(['enabled'=>false,'model'=>'test-model','key'=>'']);check($settings['hasKey'],'Empty field erased key');
$store->aiSettings(['enabled'=>false,'model'=>'test-model','clearKey'=>true]);check(!$store->aiSettings()['hasKey'],'Key removal');
echo "PASS: page drafts/publication/isolation/conflicts/validation, AI disabled and key redaction. No external requests.\n";
