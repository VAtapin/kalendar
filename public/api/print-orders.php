<?php
declare(strict_types=1);

function calendar_print_defaults(): array {
    return ['revision'=>0,'enabled'=>false,'currency'=>'eur','taxNote'=>'','terms'=>'Monatskalender 13 Blatt (12 Monate + Deckblatt)','notificationEmail'=>'',
        'minQuantity'=>5,'maxPages'=>13,'weights'=>['170'=>0,'250'=>50],
        'formats'=>['A3'=>[['min'=>5,'price'=>700],['min'=>10,'price'=>600],['min'=>50,'price'=>500]],'A4'=>[['min'=>5,'price'=>525],['min'=>10,'price'=>450],['min'=>50,'price'=>375]],'A5'=>[],'A6'=>[]],
        'paper'=>['matte'=>0,'glossy'=>0], 'cover'=>['matte'=>0,'glossy'=>0],
        'services'=>[['id'=>'preflight','name'=>'Проверка перед печатью','price'=>5000,'enabled'=>true,'perCopy'=>false],['id'=>'foil','name'=>'Фолирование первой страницы','price'=>50,'enabled'=>true,'perCopy'=>true]],
        'delivery'=>['pickup'=>0]];
}
function calendar_print_price(array $config, array $input, array $project): array {
    if (!$config['enabled']) calendar_fail('printing_disabled',409,'Приём заказов ещё не настроен');
    $quantity=$input['quantity']??0;
    if (!is_int($quantity) || $quantity<$config['minQuantity'] || $quantity>10000) calendar_fail('invalid_quantity',400,'Минимальный тираж: '.$config['minQuantity']);
    $pages=$project['document']['pages']??[];
    if (!$pages || count($pages)!==$config['maxPages']) calendar_fail('page_limit',400,'Тариф рассчитан на '.$config['maxPages'].' листов: 12 месяцев и обложка');
    $dimensions=['A3'=>[297,420],'A4'=>[210,297],'A5'=>[148,210],'A6'=>[105,148]];
    $format=null;
    foreach ($pages as $page) {
        $size=[(float)($page['width']??0),(float)($page['height']??0)]; sort($size);
        $matched=null;
        foreach ($dimensions as $key=>$mm) if (abs($size[0]-$mm[0])<0.5 && abs($size[1]-$mm[1])<0.5) $matched=$key;
        if (!$matched || ($format!==null && $format!==$matched)) calendar_fail('unsupported_format',400,'Нужны страницы одного стандартного формата A3–A6');
        $format=$matched;
    }
    $unit=null;
    foreach ($config['formats'][$format]??[] as $tier) if ($quantity >= $tier['min']) $unit=$tier['price'];
    if (!$unit) calendar_fail('missing_price',409,'Для этого формата и тиража цена ещё не настроена');
    $lines=[['name'=>"Календарь $format",'quantity'=>$quantity,'unit'=>$unit,'total'=>$unit*$quantity]];
    foreach (['paper'=>'Бумага','cover'=>'Обложка','delivery'=>'Доставка','weights'=>'Плотность, г/м²'] as $key=>$label) {
        $option=$input[$key]??'';
        if (!is_string($option) || !array_key_exists($option,$config[$key])) calendar_fail('invalid_option',400,'Выберите бумагу, обложку и получение');
        $n=$key==='delivery'?1:$quantity; $price=$config[$key][$option];
        $optionLabel=['matte'=>'Матовая','glossy'=>'Глянцевая','pickup'=>'Самовывоз','shipping'=>'Доставка'][$option]??$option;
        $lines[]=['name'=>$label.': '.$optionLabel,'quantity'=>$n,'unit'=>$price,'total'=>$price*$n];
    }
    $services=$input['services']??[];
    if (!is_array($services) || count($services)>20 || count(array_filter($services,'is_string'))!==count($services)) calendar_fail('invalid_services',400);
    foreach (array_unique($services) as $id) {
        $service=null; foreach ($config['services'] as $candidate) if ($candidate['id']===$id && $candidate['enabled']) $service=$candidate;
        if (!$service) calendar_fail('invalid_services',400);
        $n=($service['perCopy']??false)?$quantity:1;
        $lines[]=['name'=>$service['name'],'quantity'=>$n,'unit'=>$service['price'],'total'=>$service['price']*$n];
    }
    $total=array_sum(array_column($lines,'total'));
    if ($total<50 || $total>99999999) calendar_fail('invalid_total',400,'Сумма вне допустимого диапазона');
    return ['currency'=>$config['currency'],'total'=>$total,'lines'=>$lines,'format'=>$format,'pages'=>count($pages),'taxNote'=>$config['taxNote'],'terms'=>$config['terms'],'pricingRevision'=>$config['revision']];
}
function calendar_stripe_request(string $path, ?array $data=null, string $idempotency=''): array {
    $key=calendar_config_value('STRIPE_SECRET_KEY');
    if (!$key || !function_exists('curl_init')) calendar_fail('stripe_unavailable',503,'Stripe ещё не подключён');
    $handle=curl_init('https://api.stripe.com/v1/'.$path);
    $headers=['Authorization: Bearer '.$key];
    if ($idempotency!=='') $headers[]='Idempotency-Key: '.$idempotency;
    curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>30,CURLOPT_HTTPHEADER=>$headers]);
    if ($data!==null) curl_setopt_array($handle,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($data)]);
    $raw=curl_exec($handle); $status=curl_getinfo($handle,CURLINFO_RESPONSE_CODE); curl_close($handle);
    $result=is_string($raw)?json_decode($raw,true):null;
    if ($status<200 || $status>=300 || !is_array($result)) calendar_fail('stripe_error',502,'Stripe недоступен. Повторите позже; заказ сохранён.');
    return $result;
}
function calendar_stripe_verify(string $body,string $signature,string $secret,?int $now=null): array {
    if (!$secret) calendar_fail('stripe_unavailable',503);
    $timestamp=0; $signatures=[];
    foreach (explode(',',$signature) as $part) { [$key,$value]=array_pad(explode('=',trim($part),2),2,''); if($key==='t')$timestamp=(int)$value; if($key==='v1')$signatures[]=$value; }
    if (!$timestamp || abs(($now??time())-$timestamp)>300) calendar_fail('invalid_signature',400);
    $expected=hash_hmac('sha256',$timestamp.'.'.$body,$secret); $valid=false;
    foreach($signatures as $candidate) if(hash_equals($expected,$candidate))$valid=true;
    if(!$valid)calendar_fail('invalid_signature',400);
    $event=json_decode($body,true); if(!is_array($event))calendar_fail('invalid_event',400); return $event;
}

trait CalendarPrintOrders {
    public function printConfig(?array $input=null): array {
        if($input===null)return calendar_read_json_file($this->dataDirectory.'/print-config.json',calendar_print_defaults());
        return calendar_with_lock($this->locksDirectory,'print-config',function()use($input){
            $old=$this->printConfig(); if(($input['revision']??-1)!==$old['revision'])calendar_fail('revision_conflict',409,'Настройки изменились. Обновите страницу.');
            $config=calendar_print_defaults();
            foreach(['enabled','currency','taxNote','terms','notificationEmail','maxPages','minQuantity','weights','formats','paper','cover','services','delivery'] as $key) if(array_key_exists($key,$input))$config[$key]=$input[$key];
            if(!is_int($config['minQuantity'])||$config['minQuantity']<1||$config['minQuantity']>10000)calendar_fail('invalid_pricing',400);
            if(!is_bool($config['enabled']) || !in_array($config['currency'],['eur','usd','gbp'],true) || !is_int($config['maxPages']) || $config['maxPages']<0 || $config['maxPages']>100)calendar_fail('invalid_pricing',400);
            foreach(['taxNote','terms','notificationEmail'] as $key)if(!is_string($config[$key]) || strlen($config[$key])>4000)calendar_fail('invalid_pricing',400);
            if($config['notificationEmail']!=='' && !filter_var($config['notificationEmail'],FILTER_VALIDATE_EMAIL))calendar_fail('invalid_email',400);
            foreach(['formats','paper','cover','delivery','services','weights'] as $key)if(!is_array($config[$key]))calendar_fail('invalid_pricing',400);
            foreach($config['weights'] as $weight=>$price)if(!in_array((string)$weight,['170','250'],true)||!is_int($price)||$price<0||$price>10000000)calendar_fail('invalid_pricing',400);
            foreach($config['formats'] as $format=>&$tiers){
                if(!in_array($format,['A3','A4','A5','A6'],true) || !is_array($tiers) || count($tiers)>30)calendar_fail('invalid_pricing',400);
                $mins=[]; foreach($tiers as $tier){if(!is_array($tier)||!is_int($tier['min']??null)||$tier['min']<1||$tier['min']>10000||!is_int($tier['price']??null)||$tier['price']<1||$tier['price']>10000000||in_array($tier['min'],$mins,true))calendar_fail('invalid_pricing',400);$mins[]=$tier['min'];}
                usort($tiers,static fn($a,$b)=>$a['min']<=>$b['min']);
            } unset($tiers);
            foreach(['paper','cover','delivery'] as $key)foreach($config[$key] as $id=>$price){if(!in_array($id,$key==='delivery'?['pickup','shipping']:['matte','glossy'],true)||!is_int($price)||$price<0||$price>10000000)calendar_fail('invalid_pricing',400);}
            if(count($config['services'])>20)calendar_fail('invalid_pricing',400);
            foreach($config['services'] as $service)if(!is_bool($service['perCopy']??null))calendar_fail('invalid_pricing',400);
            $ids=[];foreach($config['services'] as $service){if(!is_array($service)||!is_string($service['id']??null)||!preg_match('/^[a-z0-9-]{1,40}$/',$service['id'])||in_array($service['id'],$ids,true)||!is_string($service['name']??null)||strlen($service['name'])>160||!is_int($service['price']??null)||$service['price']<0||$service['price']>10000000||!is_bool($service['enabled']??null))calendar_fail('invalid_pricing',400);$ids[]=$service['id'];}
            if($config['enabled'] && (!$config['taxNote']||!$config['terms']||!$config['notificationEmail']||!$config['maxPages']||!$config['paper']||!$config['cover']||!$config['delivery']||!array_filter($config['formats'])))calendar_fail('incomplete_pricing',400,'Укажите тарифы, налоговое описание, условия, получателя заявок и предел страниц');
            $config['revision']=$old['revision']+1;calendar_atomic_json_write($this->dataDirectory.'/print-config.json',$config);return $config;
        });
    }
    private function printOrderPath(string $id): string {if(!calendar_valid_uuid($id))calendar_fail('order_not_found',404);return $this->dataDirectory.'/print-orders/'.$id.'.json';}
    public function printOrder(string $id,?string $owner): array {
        $order=calendar_read_json_file($this->printOrderPath($id),null);
        if(!$order || ($owner!==null && $order['owner']!==$owner))calendar_fail('order_not_found',404);return $order;
    }
    public function printOrders(?string $owner): array {
        $items=[];foreach(glob($this->dataDirectory.'/print-orders/*.json')?:[] as $path){$o=calendar_read_json_file($path,null);if($o && ($owner===null||$o['owner']===$owner))$items[]=$o;}
        usort($items,static fn($a,$b)=>strcmp($b['createdAt'],$a['createdAt']));return $items;
    }
    public function printQuote(array $user,array $input): array {
        $calendar=$this->accountCalendar((string)($input['calendarId']??''),$user['id']);
        return calendar_print_price($this->printConfig(),$input,$calendar['project']);
    }
    public function printCreate(array $user,array $input): array {
        return calendar_with_lock($this->locksDirectory,'print-create-'.$user['id'],function()use($user,$input){
            $request=$input['requestId']??'';if(!is_string($request)||!calendar_valid_uuid($request))calendar_fail('invalid_request',400);
            $orders=$this->printOrders($user['id']);foreach($orders as $old)if($old['requestId']===$request)return $old;
            if(count($orders)>=200)calendar_fail('order_limit',429,'Достигнут лимит заказов. Свяжитесь с администратором.');
            $calendar=$this->accountCalendar((string)($input['calendarId']??''),$user['id']);
            if(($input['calendarRevision']??-1)!==$calendar['revision'])calendar_fail('calendar_changed',409,'Календарь изменён. Создайте PDF заново.');
            $quote=calendar_print_price($this->printConfig(),$input,$calendar['project']);
            if(($input['pricingRevision']??-1)!==$quote['pricingRevision']||($input['acceptedTotal']??-1)!==$quote['total'])calendar_fail('price_changed',409,'Цена изменилась. Пересчитайте заказ.');
            if(($input['acceptedTerms']??false)!==true)calendar_fail('terms_required',400);
            $upload=$this->readPdfUpload((string)($input['pdfId']??''));
            if(!$upload||$upload['ownerCredentialId']!==$user['id']||!isset($upload['completedAt'])||!is_file($this->pdfExportFile($upload)))calendar_fail('pdf_required',400,'Загрузите свой готовый PDF');
            if(!is_array($input['contact']??null))calendar_fail('invalid_contact',400);
            $contact=[];foreach(['name','phone','address','company','taxId','comment'] as $key){$value=$input['contact'][$key]??'';if(!is_string($value)||strlen($value)>2000)calendar_fail('invalid_contact',400);$contact[$key]=trim($value);}
            if(!$contact['name']||($input['delivery']==='shipping'&&!$contact['address']))calendar_fail('contact_required',400,'Укажите имя и адрес доставки');
            $id=calendar_uuid();$directory=$this->dataDirectory.'/print-orders';if(!is_dir($directory)&&!mkdir($directory,0700,true))throw new RuntimeException('storage_create_failed');
            // Keep the exact submitted file, independent of later calendar edits and export cleanup.
            if(!copy($this->pdfExportFile($upload),$directory.'/'.$id.'.pdf'))throw new RuntimeException('pdf_copy_failed');chmod($directory.'/'.$id.'.pdf',0600);
            $order=['id'=>$id,'requestId'=>$request,'owner'=>$user['id'],'email'=>$user['email'],'createdAt'=>calendar_now(),'updatedAt'=>calendar_now(),'status'=>'requested','payment'=>'unpaid','calendarId'=>$calendar['id'],'calendarRevision'=>$calendar['revision'],'name'=>$calendar['project']['name'],'quantity'=>$input['quantity'],'paper'=>$input['paper'],'cover'=>$input['cover'],'delivery'=>$input['delivery'],'services'=>$input['services']??[],'contact'=>$contact,'quote'=>$quote,'pdfHash'=>hash_file('sha256',$directory.'/'.$id.'.pdf'),'notification'=>'pending','history'=>[['at'=>calendar_now(),'status'=>'requested']]];
            calendar_atomic_json_write($this->printOrderPath($id),$order);return $order;
        });
    }
    public function printNotify(string $id): array {
        return calendar_with_lock($this->locksDirectory,'print-order-'.$id,function()use($id){
            $o=$this->printOrder($id,null);if($o['notification']==='sent')return $o;
            try{$recipient=$this->printConfig()['notificationEmail'];if(!filter_var($recipient,FILTER_VALIDATE_EMAIL))throw new RuntimeException('recipient_missing');
                $text="Новый заказ печати: {$o['id']}\n{$o['name']}\n{$o['email']}\nТираж: {$o['quantity']}\nФормат: {$o['quote']['format']}\nСумма: ".($o['quote']['total']/100).' '.strtoupper($o['quote']['currency'])."\nОткройте раздел «Заказы печати» в админке для проверки PDF и подтверждения заказа.";
                calendar_send_message($recipient,calendar_verification_message($recipient,'',calendar_mail_sender_address(),calendar_mail_sender_name(),false,['subject'=>'Новый заказ календарей','text'=>$text,'html'=>'<p>'.nl2br(htmlspecialchars($text,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8')).'</p>']));$o['notification']='sent';
            }catch(Throwable $error){$o['notification']='failed';error_log('Print order notification failed: '.$id);}
            calendar_atomic_json_write($this->printOrderPath($id),$o);return $o;
        });
    }
    public function printStatus(string $id,string $status): array {
        return calendar_with_lock($this->locksDirectory,'print-order-'.$id,function()use($id,$status){
            $o=$this->printOrder($id,null);
            $allowed=['requested'=>['approved','rejected'],'approved'=>['rejected'],'paid'=>['production'],'production'=>['shipped','completed'],'shipped'=>['completed']];
            if(!in_array($status,$allowed[$o['status']]??[],true)||($status==='rejected'&&isset($o['stripeSession'])))calendar_fail('invalid_status',409,'Переход недоступен. Для возврата оплаты используйте Stripe.');
            if(in_array($status,['production','shipped','completed'],true)&&$o['payment']!=='paid')calendar_fail('payment_required',409);
            $o['status']=$status;$o['updatedAt']=calendar_now();$o['history'][]=['at'=>calendar_now(),'status'=>$status];calendar_atomic_json_write($this->printOrderPath($id),$o);return $o;
        });
    }
    public function printCheckout(string $id,string $owner): array {
        return calendar_with_lock($this->locksDirectory,'print-order-'.$id,function()use($id,$owner){
            $o=$this->printOrder($id,$owner);if($o['payment']==='paid')calendar_fail('already_paid',409);
            if($o['status']!=='approved')calendar_fail('approval_required',409,'Типография сначала проверит PDF и подтвердит заказ');
            $base=rtrim(calendar_config_value('APP_PUBLIC_URL'),'/');if(!preg_match('#^https://[^/]+$#',$base)||!calendar_config_value('STRIPE_WEBHOOK_SECRET'))calendar_fail('stripe_unavailable',503,'Настройте Stripe и APP_PUBLIC_URL');
            if(isset($o['stripeSession'])){
                $session=calendar_stripe_request('checkout/sessions/'.rawurlencode($o['stripeSession']));
                if(($session['status']??'')==='open')return ['url'=>$session['url']];
                if(($session['status']??'')!=='expired')calendar_fail('payment_pending',409,'Оплата обрабатывается. Обновите список заказов позже.');
                unset($o['stripeSession'],$o['checkoutStartedAt']);$o['checkoutAttempt']=($o['checkoutAttempt']??0)+1;
                calendar_atomic_json_write($this->printOrderPath($id),$o);
            }
            $lineItems=[];
            if(isset($o['checkoutStartedAt'])&&time()-$o['checkoutStartedAt']>82800)calendar_fail('checkout_reconciliation',409,'Нужна проверка предыдущей попытки оплаты в Stripe. Свяжитесь с типографией.');
            $o['checkoutStartedAt']=$o['checkoutStartedAt']??time();calendar_atomic_json_write($this->printOrderPath($id),$o);
            foreach($o['quote']['lines'] as $line)if($line['unit']>0)$lineItems[]=['quantity'=>$line['quantity'],'price_data'=>['currency'=>$o['quote']['currency'],'unit_amount'=>$line['unit'],'product_data'=>['name'=>$line['name']]]];
            $session=calendar_stripe_request('checkout/sessions',[
                'mode'=>'payment','payment_method_types'=>['card'],'customer_email'=>$o['email'],
                'customer_creation'=>'always','billing_address_collection'=>'required',
                'invoice_creation'=>['enabled'=>'true','invoice_data'=>['metadata'=>['order_id'=>$id]]],
                'client_reference_id'=>$id,'metadata'=>['order_id'=>$id],
                'payment_intent_data'=>['metadata'=>['order_id'=>$id]],
                'success_url'=>$base.'/?print-order='.$id,'cancel_url'=>$base.'/?print-order='.$id,
                'line_items'=>$lineItems
            ],'print-'.$id.'-'.($o['checkoutAttempt']??0));
            if(!isset($session['id'],$session['url']))calendar_fail('stripe_error',502);
            $o['stripeSession']=$session['id'];calendar_atomic_json_write($this->printOrderPath($id),$o);return ['url'=>$session['url']];
        });
    }
    public function printPaymentEvent(array $event): void {
        if(($event['type']??'')==='charge.refunded'){
            $charge=$event['data']['object']??[];$intent=$charge['payment_intent']??null;
            if(!is_string($intent))return;
            foreach($this->printOrders(null) as $order)if(($order['stripePaymentIntent']??null)===$intent){
                calendar_with_lock($this->locksDirectory,'print-order-'.$order['id'],function()use($order,$charge){
                    $o=$this->printOrder($order['id'],null);$refunded=$charge['amount_refunded']??0;
                    if(($charge['currency']??'')!==$o['quote']['currency']||!is_int($refunded)||$refunded<0||$refunded>$o['quote']['total'])calendar_fail('refund_mismatch',409);
                    if($refunded<=($o['refundedAmount']??0))return;
                    $o['refundedAmount']=$refunded;$o['payment']=$refunded===$o['quote']['total']?'refunded':'partially_refunded';$o['history'][]=['at'=>calendar_now(),'status'=>$o['payment']];calendar_atomic_json_write($this->printOrderPath($o['id']),$o);
                });return;
            }return;
        }
        if(!in_array($event['type']??'', ['checkout.session.completed','checkout.session.async_payment_succeeded'],true))return;
        $s=$event['data']['object']??[];$id=$s['metadata']['order_id']??'';if(!is_string($id)||!calendar_valid_uuid($id))return;
        calendar_with_lock($this->locksDirectory,'print-order-'.$id,function()use($s,$id){
            $o=$this->printOrder($id,null);
            if(($s['id']??'')!==($o['stripeSession']??null)||($s['amount_total']??null)!==$o['quote']['total']||($s['currency']??'')!==$o['quote']['currency'])calendar_fail('payment_mismatch',409);
            if(($s['payment_status']??'')!=='paid'||in_array($o['payment'],['paid','refunded','partially_refunded'],true))return;
            $o['stripePaymentIntent']=is_string($s['payment_intent']??null)?$s['payment_intent']:null;
            $o['payment']='paid';$o['status']='paid';$o['stripeInvoice']=is_string($s['invoice']??null)?$s['invoice']:null;$o['stripeCustomer']=is_string($s['customer']??null)?$s['customer']:null;$o['updatedAt']=calendar_now();$o['history'][]=['at'=>calendar_now(),'status'=>'paid'];calendar_atomic_json_write($this->printOrderPath($id),$o);
        });
    }
    public function printPdfPath(string $id): string {return substr($this->printOrderPath($id),0,-5).'.pdf';}
}

function calendar_print_routes(CalendarStore $store,string $method,string $path): void {
    if($path==='/v1/print/stripe-webhook'&&$method==='POST'){$event=calendar_stripe_verify(api_request_body(1048576),api_header('Stripe-Signature'),calendar_config_value('STRIPE_WEBHOOK_SECRET'));$store->printPaymentEvent($event);api_response(200,['received'=>true]);}
    $admin=str_starts_with($path,'/v1/admin/print');if(!$admin&&!str_starts_with($path,'/v1/print/'))return;
    if($admin){if(api_owner($store)===null)calendar_fail('admin_required',403);$user=null;}
    else{$user=$store->accountUser(calendar_account_token());if(!$user)calendar_fail('login_required',401,'Войдите в аккаунт');}
    if(!in_array($method,['GET','HEAD'],true))calendar_admin_check_origin();
    $prefix=$admin?'/v1/admin/print':'/v1/print';$suffix=substr($path,strlen($prefix));
    if($suffix==='/config'&&($method==='GET'||($admin&&$method==='PUT'))){$c=$store->printConfig($method==='PUT'?api_request_json(32768):null);if(!$admin)unset($c['notificationEmail']);else $c['stripeReady']=(bool)(calendar_config_value('STRIPE_SECRET_KEY')&&calendar_config_value('STRIPE_WEBHOOK_SECRET'));api_response(200,$c);}
    if(!$admin&&$suffix==='/quote'&&$method==='POST')api_response(200,$store->printQuote($user,api_request_json(8192)));
    if($suffix==='/orders'&&$method==='GET')api_response(200,['items'=>$store->printOrders($user['id']??null)]);
    if(!$admin&&$suffix==='/orders'&&$method==='POST'){$o=$store->printCreate($user,api_request_json(16384));api_response(201,$store->printNotify($o['id']));}
    if(preg_match('#^/orders/([0-9a-f-]{36})(?:/(pdf|checkout|invoice|status|notify))?$#',$suffix,$m)){
        $o=$store->printOrder($m[1],$user['id']??null);$action=$m[2]??'';
        if($action===''&&$method==='GET')api_response(200,$o);
        if($action==='checkout'&&$method==='POST'&&!$admin)api_response(200,$store->printCheckout($m[1],$user['id']));
        if($action==='status'&&$method==='PUT'&&$admin)api_response(200,$store->printStatus($m[1],(string)(api_request_json(4096)['status']??'')));
        if($action==='notify'&&$method==='POST'&&$admin)api_response(200,$store->printNotify($m[1]));
        if($action==='invoice'&&$method==='GET'){
            if($o['payment']!=='paid')calendar_fail('invoice_pending',409,'Счёт ещё не готов');
            $invoiceId=$o['stripeInvoice']??null;
            if(!$invoiceId && isset($o['stripeSession'])){$session=calendar_stripe_request('checkout/sessions/'.rawurlencode($o['stripeSession']));$invoiceId=$session['invoice']??null;}
            if(!is_string($invoiceId)||!str_starts_with($invoiceId,'in_'))calendar_fail('invoice_pending',409,'Stripe ещё формирует счёт. Повторите позже.');
            $i=calendar_stripe_request('invoices/'.rawurlencode($invoiceId));api_response(200,['url'=>$i['hosted_invoice_url']??null,'pdf'=>$i['invoice_pdf']??null,'number'=>$i['number']??null]);
        }
        if($action==='pdf'&&$method==='GET'){$file=$store->printPdfPath($m[1]);if(!is_file($file))calendar_fail('pdf_not_found',404);header('Content-Type: application/pdf');header('Content-Disposition: attachment; filename="order-'.$m[1].'.pdf"');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');readfile($file);exit;}
    }
    api_response(404,['error'=>'not_found']);
}
