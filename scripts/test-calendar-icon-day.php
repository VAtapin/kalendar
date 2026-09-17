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
    IconDayStream::$payload=['data'=>[
        ['id'=>1,'title'=>'Священномученик Александр Вислянский','description'=>'Описание Александра','kind'=>'saint','images'=>[
            ['url'=>'https://bible-desktop.com/api/calendar/icons/1/images/2','width'=>100,'height'=>120],
        ],'dates'=>[['label'=>'21 января - Собор Воронежских святых','monthDay'=>'01-21']]],
        ['id'=>2,'title'=>'Икона Богородицы Неопалимая Купина','description'=>'Описание Купины','kind'=>'mother-of-god','images'=>[
            ['url'=>'https://bible-desktop.com/api/calendar/icons/2/images/2','width'=>100,'height'=>120],
            ['url'=>'https://bible-desktop.com/storage/calendar-icons/'.str_repeat('a',64).'.png','width'=>200,'height'=>240],
        ],'dates'=>[['label'=>'21 января','monthDay'=>'01-21']]],
        ['id'=>3,'title'=>'Святитель Иоасаф Белгородский','description'=>'Описание Иоасафа','kind'=>'saint','images'=>[
            ['url'=>'https://bible-desktop.com/api/calendar/icons/3/images/2','width'=>180,'height'=>240],
        ],'dates'=>[['label'=>'21 января - Обретение мощей','monthDay'=>'01-21']]],
    ]];
    $events=[
        ['id'=>'event-council','category'=>'commemoration','title'=>'Собор Воронежских святых','typeCode'=>16,'priority'=>634,'typikonMark'=>null],
        ['id'=>'event-icon','category'=>'commemoration','title'=>'Иконы Божией Матери, именуемой "Неопалимая Купина"','typeCode'=>17,'priority'=>633,'typikonMark'=>null],
        ['id'=>'event-ioasaf','category'=>'commemoration','title'=>'Обретение мощей свт. Иоасафа, еп. Белгородского','typeCode'=>4,'priority'=>850,'typikonMark'=>['id'=>'polyeleos']],
    ];
    $icons=calendar_bible_desktop_icons('2027-01-21',$events);
    check(count($icons)===3&&$icons[0]['id']===2&&$icons[1]['id']===3&&$icons[2]['id']===1,'Icon order does not use kind then resolved event rank');
    check($icons[0]['imageUrl']===$icons[0]['images'][0]['url']&&$icons[0]['width']===200&&count($icons[0]['images'])===2,'Largest image was not selected as cover');
    check($icons[1]['calendarRank']['eventId']==='event-ioasaf'&&$icons[1]['calendarRank']['typeCode']===4&&$icons[1]['calendarRank']['match']==='title','Resolved typikon rank missing from icon');
    check($icons[0]['dates'][0]['label']==='21 января','Published observance date missing');
    check(str_contains(IconDayStream::$requested,'/calendar/icons?')&&str_contains(IconDayStream::$requested,'month_day=01-21')&&str_contains(IconDayStream::$requested,'with_images=1'),'Must query the month-day icon catalogue');
    IconDayStream::$payload['data'][0]['images'][0]['url']='https://example.org/image.jpg';
    check(!array_filter(calendar_bible_desktop_icons('2027-01-21'),static fn($icon)=>$icon['id']===1),'Untrusted image accepted');
    $query=['date'=>'2027-01-21','office'=>'sixth-hour','lang'=>'cu-civil','profile'=>'typikon-strict'];
    IconDayStream::$payload=['data'=>$query+['textLanguage'=>'cu-civil','assignments'=>[],'serviceMode'=>['id'=>'ordinary']]];
    check(calendar_bible_desktop_service($query)['serviceMode']['id']==='ordinary','Central service mode lost');
    IconDayStream::$payload['data']['office']='third-hour';
    try { calendar_bible_desktop_service($query);throw new LogicException('Wrong office accepted'); }
    catch(RuntimeException $error) { check($error->getMessage()==='bible_desktop_service_unavailable','Unexpected failure'); }
    echo "PASS month-day catalogue, descriptions, all images, image origin\n";
} finally { stream_wrapper_unregister('https');if($hadHttps)stream_wrapper_restore('https'); }
