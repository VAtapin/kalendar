<?php
declare(strict_types=1);
require __DIR__.'/../public/api/calendar-texts.php';
function calendar_config_value(string $key, string $fallback = ''): string { return $fallback; }
function calendar_fail(string $code, int $status, string $message): never { throw new RuntimeException($code); }
class IconDayStream {
    public $context;
    public static array $payload = [];
    public static string $requested = '';
    private string $body = '';
    private int $offset = 0;
    public function stream_open($path, $mode, $options, &$opened): bool { self::$requested=$path;$this->body=json_encode(self::$payload);return true; }
    public function stream_read($count): string { $part=substr($this->body,$this->offset,$count);$this->offset+=strlen($part);return $part; }
    public function stream_eof(): bool { return $this->offset>=strlen($this->body); }
    public function stream_stat(): array { return []; }
}
function check(bool $ok, string $message): void { if(!$ok)throw new RuntimeException($message); }
$hadHttps=in_array('https',stream_get_wrappers(),true);
if($hadHttps)stream_wrapper_unregister('https');
stream_wrapper_register('https',IconDayStream::class);
try {
    IconDayStream::$payload=['data'=>[['id'=>1,'title'=>'Або Тбилисский','description'=>'Описание','kind'=>'saint','images'=>[
        ['url'=>'https://bible-desktop.com/api/calendar/icons/1/images/2','width'=>100,'height'=>120],
        ['url'=>'https://bible-desktop.com/storage/calendar-icons/'.str_repeat('a',64).'.png','width'=>200,'height'=>240],
    ]]]];
    $icons=calendar_bible_desktop_icons('2027-01-21');
    check(count($icons)===1&&$icons[0]['description']==='Описание'&&count($icons[0]['images'])===2,'Catalogue icon/description/images missing');
    check(str_contains(IconDayStream::$requested,'/calendar/icons?')&&str_contains(IconDayStream::$requested,'month_day=01-21')&&str_contains(IconDayStream::$requested,'with_images=1'),'Must query the month-day icon catalogue');
    IconDayStream::$payload['data'][0]['images'][0]['url']='https://example.org/image.jpg';
    IconDayStream::$payload['data'][0]['images'][1]['url']='https://example.org/other.jpg';
    check(count(calendar_bible_desktop_icons('2027-01-21'))===0,'Untrusted image accepted');
    $query=['date'=>'2027-01-21','office'=>'sixth-hour','lang'=>'cu-civil','profile'=>'typikon-strict'];
    IconDayStream::$payload=['data'=>$query+['textLanguage'=>'cu-civil','assignments'=>[],'serviceMode'=>['id'=>'ordinary']]];
    check(calendar_bible_desktop_service($query)['serviceMode']['id']==='ordinary','Central service mode lost');
    IconDayStream::$payload['data']['office']='third-hour';
    try { calendar_bible_desktop_service($query);throw new LogicException('Wrong office accepted'); }
    catch(RuntimeException $error) { check($error->getMessage()==='bible_desktop_service_unavailable','Unexpected failure'); }
    echo "PASS month-day catalogue, descriptions, all images, image origin\n";
} finally { stream_wrapper_unregister('https');if($hadHttps)stream_wrapper_restore('https'); }
