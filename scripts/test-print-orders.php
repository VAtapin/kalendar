<?php
declare(strict_types=1);
require_once __DIR__.'/../public/api/lib.php';
$directory=__DIR__.'/../tmp/print-test-'.bin2hex(random_bytes(5));$store=new CalendarStore($directory);
function print_check(bool $ok,string $label):void{if(!$ok)throw new RuntimeException($label);echo "PASS: $label\n";}
function print_reject(callable $call,int $status):void{try{$call();throw new RuntimeException('Unexpected success');}catch(ApiFailure $e){print_check($e->httpStatus===$status,'Rejected '.$status);}}
$config=$store->printConfig();$config['enabled']=true;$config['taxNote']='TEST inclusive price';$config['notificationEmail']='test@example.org';$config=$store->printConfig($config);
$project=['name'=>'Print test','year'=>2027,'document'=>['pages'=>array_fill(0,13,['width'=>297,'height'=>420])],'assets'=>[]];
$input=['quantity'=>5,'paper'=>'matte','cover'=>'matte','delivery'=>'pickup','weights'=>'170','services'=>[]];
foreach([5=>3500,9=>6300,10=>6000,49=>29400,50=>25000,100=>50000] as $n=>$total){$input['quantity']=$n;print_check(calendar_print_price($config,$input,$project)['total']===$total,'A3 price boundary '.$n);}
$a4=$project;$a4['document']['pages']=array_fill(0,13,['width'=>210,'height'=>297]);$input['quantity']=10;
print_check(calendar_print_price($config,$input,$a4)['total']===4500,'A4 25 percent discount');
$input['services']=['preflight','foil'];$input['weights']='250';print_check(calendar_print_price($config,$input,$project)['total']===12000,'Checking per order, foil and heavy paper per copy');
$input['quantity']=4;print_reject(fn()=>calendar_print_price($config,$input,$project),400);$input['quantity']=10;
$bad=$project;array_pop($bad['document']['pages']);print_reject(fn()=>calendar_print_price($config,$input,$bad),400);
$bad=$project;$bad['document']['pages'][0]['width']=210;print_reject(fn()=>calendar_print_price($config,$input,$bad),400);
print_reject(fn()=>$store->printConfig(array_merge($config,['revision'=>0])),409);
$link=$store->accountEmailLink('print-a@example.org',false);$user=$store->accountUser($store->accountSetPassword($link['token'],'print-password-123'));
$link=$store->accountEmailLink('print-b@example.org',false);$other=$store->accountUser($store->accountSetPassword($link['token'],'print-password-123'));
$calendar=$store->accountSaveCalendar($user['id'],null,$project,0);
$pdf="%PDF-1.4\nprint fixture\n%%EOF";$upload=$store->createPdfUpload($user['id'],'print.pdf',strlen($pdf));$pdfId=$upload['upload']['id'];$store->writePdfChunk($pdfId,$upload['uploadToken'],0,$pdf);$store->completePdfUpload($pdfId,$upload['uploadToken']);
$input+=['calendarId'=>$calendar['id'],'calendarRevision'=>$calendar['revision'],'pdfId'=>$pdfId,'requestId'=>calendar_uuid(),'contact'=>['name'=>'Test customer'],'acceptedTerms'=>true,'acceptedTotal'=>12000,'pricingRevision'=>$config['revision']];
print_reject(fn()=>$store->printCreate($other,$input),404);
print_reject(fn()=>$store->printCreate($user,array_merge($input,['acceptedTotal'=>1])),409);
$order=$store->printCreate($user,$input);print_check($order['quote']['total']===12000,'Server fixes price, specification and PDF hash');
print_check($store->printCreate($user,$input)['id']===$order['id']&&count($store->printOrders($user['id']))===1,'Duplicate request is idempotent');
print_check(count($store->printOrders($other['id']))===0,'Private order list');print_reject(fn()=>$store->printOrder($order['id'],$other['id']),404);
print_check(file_get_contents($store->printPdfPath($order['id']))===$pdf,'Immutable print file');
print_reject(fn()=>$store->printStatus($order['id'],'production'),409);$store->printStatus($order['id'],'approved');
// Simulate Stripe identifiers only; no API calls or real payments.
$order=$store->printOrder($order['id'],null);$order['stripeSession']='cs_test_fixture';calendar_atomic_json_write($directory.'/print-orders/'.$order['id'].'.json',$order);
$event=['type'=>'checkout.session.completed','data'=>['object'=>['id'=>'cs_test_fixture','metadata'=>['order_id'=>$order['id']],'payment_status'=>'paid','amount_total'=>12000,'currency'=>'eur','invoice'=>'in_test_fixture']]];
$body=json_encode($event);$time=time();$signature='t='.$time.',v1='.hash_hmac('sha256',$time.'.'.$body,'whsec_test');
print_check(calendar_stripe_verify($body,$signature,'whsec_test')['type']==='checkout.session.completed','Signed raw webhook accepted');
print_reject(fn()=>calendar_stripe_verify($body.'x',$signature,'whsec_test'),400);print_reject(fn()=>calendar_stripe_verify($body,$signature,'whsec_test',$time+301),400);
$bad=$event;$bad['data']['object']['amount_total']=100;print_reject(fn()=>$store->printPaymentEvent($bad),409);
$store->printPaymentEvent($event);$store->printStatus($order['id'],'production');$store->printPaymentEvent($event);
print_check($store->printOrder($order['id'],null)['status']==='production','Duplicate payment webhook cannot regress production');
// Refund events are monotonic and a repeated success cannot turn a refund back into a payment.
$current=$store->printOrder($order['id'],null);$current['stripePaymentIntent']='pi_fixture';calendar_atomic_json_write($directory.'/print-orders/'.$order['id'].'.json',$current);
$refund=['type'=>'charge.refunded','data'=>['object'=>['payment_intent'=>'pi_fixture','amount_refunded'=>12000,'currency'=>'eur']]];
$store->printPaymentEvent($refund);$store->printPaymentEvent($event);
print_check($store->printOrder($order['id'],null)['payment']==='refunded','Refund remains recorded after duplicate payment event');
echo "All print order tests passed. No external Stripe calls or real email.\n";
