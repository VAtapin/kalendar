<?php
// Runs against a disposable real WordPress installation supplied by the Node runner.
require $argv[1].'/wp-load.php';
function oc_assert($condition,$message){if(!$condition)throw new Exception($message);}
$path='/assets/typikon/great.svg';$url=Orthocal_Media_Cache::url($path);
oc_assert(str_contains($url,'/uploads/orthocal-cache/'),'Image must be local');
$before=Orthocal_Media_Cache::metadata($path);$calls=0;$calendarOrigin=Orthocal_Config::calendar_origin();
$spy=function($pre,$args,$url)use(&$calls,$path,$calendarOrigin){if($url===$calendarOrigin.$path){$calls++;oc_assert(!empty($args['headers']['If-None-Match']),'Conditional GET missing ETag');}return $pre;};
add_filter('pre_http_request',$spy,1,3);
Orthocal_Media_Cache::refresh($path);remove_filter('pre_http_request',$spy,1);
oc_assert($calls===1,'Exactly one revalidation');oc_assert(Orthocal_Media_Cache::metadata($path)['file']===$before['file'],'304 keeps local file');
$oldBytes=file_get_contents(Orthocal_Media_Cache::directory()['path'].'/'.$before['file']);
$changed='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="4" fill="red"/></svg>';
$mock=function($pre,$args,$url)use($path,$changed,$calendarOrigin){return $url===$calendarOrigin.$path?['headers'=>['etag'=>'"changed"'],'body'=>$changed,'response'=>['code'=>200],'cookies'=>[]]:$pre;};
// Higher priority than the installed fixture so this response is final.
add_filter('pre_http_request',$mock,99,3);Orthocal_Media_Cache::refresh($path);remove_filter('pre_http_request',$mock,99);
$after=Orthocal_Media_Cache::metadata($path);oc_assert($after['file']!==$before['file'],'Changed bytes must change browser URL');
oc_assert(is_file(Orthocal_Media_Cache::directory()['path'].'/'.$before['file']),'Open pages retain old file');
$rasterSource='https://bible-desktop.com/api/calendar/icons/1/images/1';
if(function_exists('imagecreatetruecolor')&&function_exists('imagepng')&&function_exists('getimagesize')) {
    $rasterName=str_repeat('a',64).'.png';$rasterFile=Orthocal_Media_Cache::directory()['path'].'/'.$rasterName;
    $raster=imagecreatetruecolor(240,160);imagefill($raster,0,0,imagecolorallocate($raster,150,80,40));imagepng($raster,$rasterFile);imagedestroy($raster);
    update_option('orthocal_media_'.hash('sha256',$rasterSource),['source'=>$rasterSource,'file'=>$rasterName,'checked'=>time(),'retry'=>0],false);
    $thumbnail=Orthocal_Media_Cache::thumbnail_url($rasterSource);$thumbnailFile=Orthocal_Media_Cache::directory()['path'].'/'.basename((string)parse_url($thumbnail,PHP_URL_PATH));$dimensions=getimagesize($thumbnailFile);
    oc_assert($thumbnail!==Orthocal_Media_Cache::cached_url($rasterSource),'Raster thumbnail must not reuse the original');
    oc_assert($dimensions[0]<=96&&$dimensions[1]<=96,'Thumbnail exceeds 96 pixels');
}
$fail=function($pre,$args,$url)use($path,$calendarOrigin){return $url===$calendarOrigin.$path?new WP_Error('offline','Offline'):$pre;};
add_filter('pre_http_request',$fail,99,3);Orthocal_Media_Cache::refresh($path);remove_filter('pre_http_request',$fail,99);
oc_assert(Orthocal_Media_Cache::metadata($path)['file']===$after['file'],'Failure preserves working copy');
oc_assert(Orthocal_Media_Cache::source('https://evil.test/assets/typikon/great.svg')===false,'External host accepted');
oc_assert(Orthocal_Media_Cache::source('/assets/typikon/../../x.php')===false,'Traversal accepted');
oc_assert(Orthocal_Media_Cache::validate_body('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>','svg')===false,'DTD accepted');
$clean=Orthocal_Media_Cache::validate_body('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject/><path d="M0 0" onclick="alert(1)" fill="url(https://evil.test/a)"/></svg>','svg');
oc_assert(!str_contains($clean,'script')&&!str_contains($clean,'onload')&&!str_contains($clean,'onclick')&&!str_contains($clean,'foreignObject')&&!str_contains($clean,'evil.test'),'Unsafe SVG survived');
oc_assert(Orthocal_Media_Cache::validate_body('<?php echo 1;','png')===false,'PHP accepted as PNG');
$styled=Orthocal_Media_Cache::validate_body('<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:none;stroke:red}.a,.b{stroke-width:2}</style><circle class="a" r="5"/><path style="fill:url(https://evil.test/x)"/></svg>','svg');
oc_assert(str_contains($styled,'fill="none"')&&str_contains($styled,'stroke="red"')&&str_contains($styled,'stroke-width="2"')&&!str_contains($styled,'<style')&&!str_contains($styled,'evil.test'),'Presentation styles not safely preserved');
// Restore production fixture so screenshots use the real supplied Typikon sign.
Orthocal_Media_Cache::refresh($path);
echo "PASS media: local storage, ETag/304, changed content URL, failed refresh, SSRF/path/DTD/SVG rejection\n";
