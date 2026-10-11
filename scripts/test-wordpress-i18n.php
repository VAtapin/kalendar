<?php
require rtrim($argv[1],'/\\').'/wp-load.php';
require_once ABSPATH.'wp-admin/includes/template.php';
$locale=$argv[2];
$expected=['en_US'=>['Connection','Today'],'ru_RU'=>['Подключение','Сегодня'],'de_DE'=>['Verbindung','Heute'],'uk'=>['Підключення','Сьогодні'],'pl_PL'=>['Połączenie','Dzisiaj']][$locale];
update_option('WPLANG',$locale);
update_user_meta(1,'locale',$locale);
$GLOBALS['locale']=$locale;
unload_textdomain('georg-kloster-calendar-workshop');
$path=WP_PLUGIN_DIR.'/orthocal/languages/georg-kloster-calendar-workshop-'.$locale.'.mo';
if($locale!=='en_US'&&!load_textdomain('georg-kloster-calendar-workshop',$path))throw new RuntimeException('Gettext MO load failed');
if(__('Today','georg-kloster-calendar-workshop')!==$expected[1])throw new RuntimeException('Core gettext translation failed');
wp_set_current_user(1);
ob_start();Orthocal_Admin::page();$html=ob_get_clean();
if(!str_contains($html,$expected[0]))throw new RuntimeException('Admin PHP locale failed');
if($locale==='en_US') {
    // Page titles are user content and must retain their original language.
    $interface=preg_replace('/<select[^>]*data-oc-build="day_page"[^>]*>.*?<\/select>/s','',$html);
    if(preg_match('/[А-Яа-яЁё]/u',wp_strip_all_tags($interface)))throw new RuntimeException('Russian UI leaked into the English admin');
    $selector=Orthocal_Library::language_control(['lang'=>'en','text_language'=>'de']);
    foreach(['Russian','Church Slavonic','German','Polish','Ukrainian'] as $label)if(!str_contains($selector,$label))throw new RuntimeException('English language selector failed');
}
foreach(['en'=>'Today','ru'=>'Сегодня','de'=>'Heute','uk'=>'Сьогодні','pl'=>'Dzisiaj'] as $language=>$title) {
    $value=Orthocal_I18n::with_language($language,static fn()=>Orthocal_I18n::text('Today'));
    if($value!==$title)throw new RuntimeException('Mixed block languages failed');
    if($language==='en')continue;
    $data=Orthocal_Plugin::config(['mode'=>'prayers','lang'=>$language,'text_language'=>'de']);
    if($data['text_language']!=='de')throw new RuntimeException('Text language changed');
    $custom=Orthocal_Plugin::config(['lang'=>$language,'branding'=>'Сегодня']);
    if($custom['branding']!=='Сегодня')throw new RuntimeException('Custom branding was translated');
}
if(Orthocal_I18n::text('Today')!==$expected[1])throw new RuntimeException('Block language leaked into admin');
foreach(['orthocal','orthocal-admin','orthocal-editor'] as $handle)if(!in_array('wp-i18n',wp_scripts()->registered[$handle]->deps,true))throw new RuntimeException('Missing wp-i18n dependency');
if(Orthocal_I18n::with_language('ru',static fn()=>Orthocal_I18n::text('date month|January'))!=='января')throw new RuntimeException('Date month context lost');
if(Orthocal_I18n::with_language('ru',static fn()=>Orthocal_I18n::text('month name|January'))!=='Январь')throw new RuntimeException('Month label context lost');
if($locale==='en_US'){if(Orthocal_I18n::text('date month|January')!=='January')throw new RuntimeException('English context fallback failed');echo "PASS en_US: English source, admin and block labels without a language pack\n";exit;}
$pack=WP_LANG_DIR.'/plugins/georg-kloster-calendar-workshop-'.$locale.'-'.md5('assets/admin.js').'.json';
wp_mkdir_p(dirname($pack));
if(file_exists($pack))throw new RuntimeException('Do not overwrite an existing test language pack');
try {
    $json=file_get_contents(WP_PLUGIN_DIR.'/orthocal/languages/georg-kloster-calendar-workshop-'.$locale.'-orthocal-admin.json');
    file_put_contents($pack,$json);
    foreach(array_keys(Orthocal_Plugin::TITLES) as $mode)unregister_block_type('orthocal/'.$mode);
    Orthocal_Plugin::register();
    if(wp_scripts()->registered['orthocal-admin']->translations_path!==WP_LANG_DIR.'/plugins')throw new RuntimeException('Official language pack did not take priority');
    if(load_script_textdomain('orthocal-admin','georg-kloster-calendar-workshop',WP_LANG_DIR.'/plugins')!==$json)throw new RuntimeException('Official script catalogue did not load');
} finally {if(is_file($pack))unlink($pack);}
echo "PASS $locale: WordPress gettext, translated admin, mixed block languages, separate text language, script dependencies\n";
