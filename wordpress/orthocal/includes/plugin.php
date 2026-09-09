<?php
if (!defined('ABSPATH')) exit;

final class Orthocal_Plugin {
    const CALENDAR = 'https://kalender.georg-kloster.ru/api/v1/calendar/';
    const BIBLE = 'https://bible-desktop.com/api/';
    const VERSION = '1.3.27';
    const TITLES = ['today'=>'Сегодня', 'upcoming'=>'Ближайшие праздники', 'month'=>'Календарь на месяц', 'year'=>'Календарь на год', 'day'=>'День календаря', 'readings'=>'Чтения дня', 'calendar'=>'Православный календарь','fasting'=>'Пост и трапеза','saints'=>'Памяти святых','feasts'=>'Праздники','memorial'=>'Поминальные дни','pascha'=>'Пасха','fasts'=>'Посты на год','date'=>'Дата по двум стилям','texts'=>'Богослужебные тексты','troparia'=>'Тропари','kontakia'=>'Кондаки','prayers'=>'Молитвы','magnifications'=>'Величания','horologion'=>'Часослов'];
    const TEXT_MODES=['texts','troparia','kontakia','prayers','magnifications'];
    const SERVICE_MODES=['horologion'];
    private static $file;
    private static $memo = [];

    static function boot($file) {
        self::$file = $file;
        Orthocal_Media_Cache::boot();
        Orthocal_Admin::boot($file);
        add_action('init', [self::class, 'register']);
        add_action('wp_enqueue_scripts', function () {
            $post=get_post();
            if ($post && (str_contains($post->post_content,'[orthocal_') || str_contains($post->post_content,'wp:orthocal/'))) {
                wp_enqueue_style('orthocal'); wp_enqueue_script('orthocal');
            }
        });
        add_action('template_redirect', function () {
            $post=get_post();
            if ($post && (str_contains($post->post_content,'[orthocal_') || str_contains($post->post_content,'wp:orthocal/'))) {
                if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE',true);
                nocache_headers();
            }
        });
        add_action('wp_footer', function () {
            // Shortcodes in widgets/templates may be discovered after wp_head.
            if (wp_style_is('orthocal','enqueued') && !wp_style_is('orthocal','done')) wp_print_styles('orthocal');
        },5);
        add_action('admin_menu', function () { add_menu_page('Православный календарь', 'Православный календарь', 'manage_options', 'orthocal', [self::class, 'settings_page'], 'dashicons-calendar-alt', 58); });
        add_action('admin_enqueue_scripts', function ($hook) {
            if ($hook==='toplevel_page_orthocal') { wp_enqueue_style('orthocal'); wp_enqueue_script('orthocal'); wp_enqueue_style('orthocal-admin'); wp_enqueue_script('orthocal-admin'); }
        });
        add_action('admin_init', function () { register_setting('orthocal', 'orthocal_options', ['sanitize_callback'=>[self::class,'sanitize_options']]); });
        add_action('rest_api_init', function () {
            register_rest_route('orthocal/v1', '/font', ['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function(){ $rate=self::throttle();if(is_wp_error($rate))return $rate;return new WP_REST_Response(['url'=>Orthocal_Media_Cache::url('/calendar-api-font.php')]); }]);
            register_rest_route('orthocal/v1', '/render', ['methods'=>'GET', 'permission_callback'=>'__return_true', 'callback'=>[self::class,'rest_render']]);
            register_rest_route('orthocal/v1', '/bible', ['methods'=>'GET', 'permission_callback'=>'__return_true', 'callback'=>[self::class,'rest_bible']]);
        });
    }

    static function options() {
        return wp_parse_args(get_option('orthocal_options', []), ['key'=>'','lang'=>'ru','profile'=>'typikon-strict','theme'=>'book','css_mode'=>'plugin','accent'=>'#9a352d','translation'=>'','oldstyle'=>'1','compact'=>'0','show_nav'=>'1','show_picker'=>'1','show_copy'=>'1','show_search'=>'0','show_section_titles'=>'1','show_font_size'=>'1','open'=>'inline','reading_open'=>'inline','day_page'=>'0','images'=>'1','image_size'=>'medium','image_pack'=>'ornamental','icons'=>'0','icon_limit'=>'all','office'=>'horologion','heading'=>'1','branding'=>'Календарная мастерская','sections'=>'fasting,saints,readings,texts,icons','event_levels'=>'0,1,2,3,4','media_hours'=>'24','bible_hours'=>'24']);
    }
    static function sanitize_options($input) {
        $old = self::options(); $out = [];
        foreach (['lang'=>['ru','cu','de','uk','pl'], 'profile'=>['typikon-strict','parish'], 'theme'=>['book','modern','inherit'],'css_mode'=>['plugin','site'],'open'=>['inline','modal','new','page'],'reading_open'=>['inline','modal'],'image_pack'=>array_keys(Orthocal_Admin::packs()),'image_size'=>['small','medium','large']] as $name=>$allowed) {
            $out[$name] = in_array($input[$name] ?? '', $allowed, true) ? $input[$name] : $old[$name];
        }
        $out['key'] = !empty($input['clear_key']) ? '' : (empty($input['key']) ? $old['key'] : sanitize_text_field($input['key']));
        $out['translation'] = array_key_exists('translation',$input) ? sanitize_text_field($input['translation']) : $old['translation'];
        $out['accent'] = array_key_exists('accent',$input) ? (sanitize_hex_color($input['accent']) ?: '#9a352d') : $old['accent'];
        foreach (['oldstyle','compact','show_nav','show_picker','show_copy','show_search','show_section_titles','show_font_size','images','icons','heading'] as $name) $out[$name] = array_key_exists($name,$input) ? (empty($input[$name]) ? '0' : '1') : $old[$name];
        $out['branding']=array_key_exists('branding',$input)?sanitize_text_field($input['branding']):$old['branding'];
        $out['day_page']=array_key_exists('day_page',$input)?(string)absint($input['day_page']):$old['day_page'];
        foreach(['media_hours'=>[6,12,24,168],'bible_hours'=>[0,1,6,24]] as $name=>$values) $out[$name]=(string)(in_array((int)($input[$name]??-1),$values,true)?(int)$input[$name]:(int)$old[$name]);
        if(array_key_exists('sections',$input)){$sections=is_array($input['sections'])?$input['sections']:explode(',',(string)$input['sections']);$out['sections']=implode(',',array_intersect(['fasting','saints','readings','texts','icons'],$sections));}
        else $out['sections']=$old['sections'];
        if(array_key_exists('event_levels',$input)){$levels=is_array($input['event_levels'])?$input['event_levels']:explode(',',(string)$input['event_levels']);$out['event_levels']=implode(',',array_intersect(['0','1','2','3','4'],$levels));}else $out['event_levels']=$old['event_levels'];
        // Invalidate the previous generation without scanning or deleting unrelated options.
        update_option('orthocal_cache_generation', wp_generate_uuid4(), false);
        return $out;
    }
    static function register() {
        $url = plugin_dir_url(self::$file);
        wp_register_style('orthocal', $url.'assets/calendar.css', [], self::VERSION);
        wp_register_script('orthocal', $url.'assets/calendar.js', [], self::VERSION, true);
        wp_register_script('orthocal-editor', $url.'assets/editor.js', ['wp-blocks','wp-element','wp-block-editor','wp-components','wp-server-side-render'], self::VERSION, true);
        wp_register_style('orthocal-admin',$url.'assets/admin.css',[],self::VERSION);
        wp_register_script('orthocal-admin',$url.'assets/admin.js',[],self::VERSION,true);
        foreach (self::TITLES as $mode=>$title) {
            add_shortcode('orthocal_'.$mode, function ($attrs) use ($mode) { return self::render(is_array($attrs) ? array_merge($attrs, ['mode'=>$mode]) : ['mode'=>$mode]); });
            register_block_type(dirname(self::$file).'/blocks/'.$mode, ['render_callback'=>function ($attrs) use ($mode) { return self::render(array_merge($attrs,['mode'=>$mode])); }]);
        }
    }
    static function key() { return defined('ORTHOCAL_API_KEY') ? ORTHOCAL_API_KEY : self::options()['key']; }
    static function date_valid($date) {
        return is_string($date) && preg_match('/^(19\d{2}|20\d{2}|21\d{2}|2200)-(\d{2})-(\d{2})$/D', $date, $m) && checkdate((int)$m[2], (int)$m[3], (int)$m[1]);
    }
    static function config($attrs) {
        $o = self::options();
        $attrs = array_filter($attrs, static fn($value) => $value !== '');
        $a = shortcode_atts(['mode'=>'today','date'=>'','year'=>'','month'=>'','limit'=>'5','filter'=>'main','scope'=>'','tone'=>'','weekday'=>'','text_id'=>'','translation'=>$o['translation'],'day_page'=>$o['day_page'],'accent'=>$o['accent'],'branding'=>$o['branding']]+array_intersect_key($o,array_flip(['lang','profile','theme','css_mode','compact','oldstyle','show_nav','show_picker','show_copy','show_search','show_section_titles','show_font_size','open','reading_open','images','image_size','image_pack','icons','icon_limit','office','heading','sections','event_levels'])), $attrs);
        if (!isset(self::TITLES[$a['mode']])) return new WP_Error('mode','Неизвестный блок.');
        if($a['mode']==='memorial')$a['filter']='memorial';
        if(!in_array($a['scope'],['','resurrection','weekday','common'],true)||($a['tone']!==''&&!preg_match('/^[1-8]$/D',(string)$a['tone']))||($a['weekday']!==''&&!preg_match('/^[0-6]$/D',(string)$a['weekday']))||($a['text_id']!==''&&!preg_match('/^[a-z0-9-]{1,100}$/D',$a['text_id'])))return new WP_Error('texts','Неверные параметры библиотеки текстов.');
        $date = $a['date'] ?: wp_date('Y-m-d');
        if (!self::date_valid($date)) return new WP_Error('date','Дата должна быть в диапазоне 1900–2200, в формате ГГГГ-ММ-ДД.');
        $a['date'] = $date;
        $a['year'] = $a['year'] === '' ? (int)substr($date,0,4) : filter_var($a['year'], FILTER_VALIDATE_INT);
        $a['month'] = $a['month'] === '' ? (int)substr($date,5,2) : filter_var($a['month'], FILTER_VALIDATE_INT);
        $a['limit'] = filter_var($a['limit'], FILTER_VALIDATE_INT);
        if ($a['year'] < 1900 || $a['year'] > 2200 || $a['month'] < 1 || $a['month'] > 12 || $a['limit'] < 1 || $a['limit'] > 10) return new WP_Error('range','Неверный год, месяц или количество праздников.');
        foreach (['lang'=>['ru','cu','de','uk','pl'],'profile'=>['typikon-strict','parish'],'theme'=>['book','modern','inherit'],'css_mode'=>['plugin','site'],'filter'=>['main','twelve','great','memorial','all'],'open'=>['inline','modal','new','page'],'reading_open'=>['inline','modal'],'image_pack'=>array_keys(Orthocal_Admin::packs()),'image_size'=>['small','medium','large'],'icon_limit'=>['1','3','5','8','all'],'office'=>['horologion','first-hour','third-hour','sixth-hour','ninth-hour','matins','vespers','compline','typica']] as $name=>$allowed) if (!in_array($a[$name],$allowed,true)) return new WP_Error('option','Неверный параметр календаря.');
        $a['accent']=sanitize_hex_color((string)$a['accent']) ?: '#9a352d';
        $a['branding']=sanitize_text_field((string)$a['branding']);
        $a['translation']=sanitize_key((string)$a['translation']);
        $a['day_page']=(string)absint($a['day_page']);
        foreach (['compact','oldstyle','show_nav','show_picker','show_copy','show_search','show_section_titles','show_font_size','images','icons','heading'] as $name) $a[$name] = in_array((string)$a[$name], ['1','true'],true) ? '1' : '0';
        $a['event_levels']=implode(',',array_intersect(['0','1','2','3','4'],array_filter(explode(',',(string)$a['event_levels']),static fn($v)=>in_array($v,['0','1','2','3','4'],true))));
        if(!is_string($a['sections']) || array_diff(array_filter(explode(',',$a['sections'])),['fasting','saints','readings','texts','icons']))return new WP_Error('sections','Неизвестный раздел дня.');
        return $a;
    }
    static function request($service, $path, $query = []) {
        $calendar=in_array($service,['calendar','texts','service'],true);
        $url = ($service === 'calendar' ? self::CALENDAR : ($service==='texts'?'https://kalender.georg-kloster.ru/api/v1/calendar-texts/':($service==='service'?'https://kalender.georg-kloster.ru/api/v1/calendar/service':self::BIBLE))).$path;
        if ($query) $url = add_query_arg($query,$url);
        $cache = 'oc_'.md5($url.'|'.self::key().'|'.get_option('orthocal_cache_generation','0'));
        if (isset(self::$memo[$cache])) return self::$memo[$cache];
        $cached = get_transient($cache);
        if (is_array($cached)) return self::$memo[$cache] = $cached;
        $cooldown = get_transient('oc_cooldown_'.$service);
        if ($cooldown) return new WP_Error('busy','Сервис временно недоступен. Повторите позже.');
        $headers = ['Accept'=>'application/json'];
        if ($calendar && self::key()) $headers['X-API-Key'] = self::key();
        $response = wp_safe_remote_get($url, ['timeout'=>25,'redirection'=>0,'headers'=>$headers,'limit_response_size'=>12*1024*1024]);
        if (is_wp_error($response)) return new WP_Error('connection','Не удалось подключиться к '.($calendar ? 'календарю.' : 'BibleDesktop.'));
        $status = wp_remote_retrieve_response_code($response);
        if ($status !== 200) {
            if (in_array($status,[429,503],true)) set_transient('oc_cooldown_'.$service,1,min(3600,max(2,(int)wp_remote_retrieve_header($response,'retry-after'))));
            $messages = [401=>'API-ключ отсутствует или недействителен.',403=>'Доступ к API отключён или истёк.',429=>'Достигнут лимит запросов. Повторите позже.',503=>'API занят или обновляется. Повторите позже.'];
            return new WP_Error('upstream',$messages[$status] ?? 'Источник данных недоступен (HTTP '.$status.').');
        }
        $data = json_decode(wp_remote_retrieve_body($response), true);
        if (!is_array($data)) return new WP_Error('schema','Источник вернул неверный формат данных.');
        if ($calendar) {
            $remaining = wp_remote_retrieve_header($response,'x-api-month-remaining');
            if ($remaining !== '') update_option('orthocal_quota', ['remaining'=>(int)$remaining,'checked'=>time()], false);
        }
        $ttl = $calendar ? min(300,max(0,(int)wp_remote_retrieve_header($response,'x-calendar-application-cache-ttl'))) : (int)self::options()['bible_hours']*3600;
        if($service==='bible') {
            $permission=wp_remote_retrieve_header($response,'x-bible-application-cache-ttl');
            if($permission!=='')$ttl=min($ttl,max(0,(int)$permission));
            elseif(stripos(wp_remote_retrieve_header($response,'cache-control'),'no-store')!==false)$ttl=0;
        }
        if ($ttl) set_transient($cache,$data,$ttl);
        return self::$memo[$cache] = $data;
    }
    static function data($a) {
        $q = ['lang'=>$a['lang'],'profile'=>$a['profile']]; $mode = $a['mode'];
        if(in_array($mode,self::SERVICE_MODES,true)) {
            return self::request('service','',['date'=>$a['date'],'office'=>$a['office'],'lang'=>$a['lang'],'profile'=>$a['profile'],'expansion'=>'full']);
        }
        if(in_array($mode,self::TEXT_MODES,true)) {
            $types=['troparia'=>'troparion','kontakia'=>'kontakion','prayers'=>'prayer','magnifications'=>'magnification'];$query=['language'=>'cu'];
            if(isset($types[$mode]))$query['type']=$types[$mode];
            foreach(['scope','tone','weekday'] as $key)if($a[$key]!=='')$query[$key]=$a[$key];
            if($a['text_id']!=='')$query['id']=$a['text_id'];
            return self::request('texts','',$query);
        }
        if (in_array($mode,['today','day','readings','fasting','saints','date'],true)) {
            if (!self::key() && $mode === 'today') {
                $value = self::request('calendar','today',$q);
                if (!is_wp_error($value) && ($value['day']['date'] ?? '') !== $a['date']) return new WP_Error('timezone','Для даты в часовом поясе этого сайта нужен API-ключ. Публичный день определяется по Europe/Berlin.');
                return $value;
            }
            return self::request('calendar','day',$q+['date'=>$a['date']]);
        }
        if (in_array($mode,['upcoming','feasts','memorial'],true)) return self::request('calendar','upcoming',$q+['date'=>$a['date'],'limit'=>$a['limit'],'filter'=>$a['filter']]);
        if($mode==='pascha')return self::request('calendar','pascha',$q+['year'=>$a['year']]);
        $q += ['year'=>$a['year'],'view'=>'summary'];
        if (in_array($mode,['month','calendar'],true)) $q['month'] = $a['month'];
        return self::request('calendar',in_array($mode,['month','calendar'],true)?'month':'year',$q);
    }
    static function error_html($message) { return '<p class="oc-message" role="status">'.esc_html($message).'</p>'; }
    static function render($attrs, $ajax = false) {
        $a = self::config($attrs);
        if (is_wp_error($a)) return self::error_html($a->get_error_message());
        $selected = false;
        if (!$ajax && !empty($_GET['orthocal_date']) && is_string($_GET['orthocal_date']) && self::date_valid($_GET['orthocal_date'])) {
            $selected = true;
            $a['date'] = $_GET['orthocal_date']; $a['year'] = (int)substr($a['date'],0,4); $a['month'] = (int)substr($a['date'],5,2);
            if (in_array($a['mode'],['today','day'],true)) $a['mode'] = 'day';
        }
        wp_enqueue_style('orthocal'); wp_enqueue_script('orthocal');
        $data = self::data($a);
        $page=(int)$a['day_page'];$pageUrl=$page && get_post_status($page)==='publish'?get_permalink($page):'';
        $config = $a + ['endpoint'=>rest_url('orthocal/v1/'), 'liveDate'=>empty($attrs['date']) && empty($_GET['orthocal_date']), 'pageUrl'=>$pageUrl,'fontUrl'=>$a['lang']==='cu'||in_array($a['mode'],self::TEXT_MODES,true)?Orthocal_Media_Cache::url('/calendar-api-font.php'):''];
        $html = '<section class="orthocal oc-theme-'.esc_attr($a['theme']).($a['css_mode']==='site'?' oc-site-css':'').($a['compact']==='1'?' oc-compact':'').'" style="--oc-accent:'.esc_attr($a['accent']).';--oc-image-size:'.($a['image_size']==='small'?'28px':($a['image_size']==='large'?'72px':'44px')).'" data-oc-language="'.esc_attr($a['lang']).'" data-orthocal="'.esc_attr(wp_json_encode($config)).'" aria-label="'.esc_attr(self::TITLES[$a['mode']]).'">';
        if($a['heading']==='1')$html .= '<div class="oc-heading">'.($a['branding']!==''?'<span class="oc-eyebrow">'.esc_html($a['branding']).'</span>':'').(in_array($a['mode'],['today','day'],true)?'':'<h2>'.esc_html(self::TITLES[$a['mode']]).'</h2>').'</div>';
        if (is_wp_error($data)) $html .= self::error_html($data->get_error_message()).'<button type="button" data-oc-retry>Повторить</button>';
        elseif(in_array($a['mode'],self::SERVICE_MODES,true)&&isset($data['assignments']))$html.=self::service($data,$a);
        elseif(in_array($a['mode'],self::TEXT_MODES,true)&&isset($data['texts']))$html.=self::texts($data,$a);
        elseif (isset($data['day']['events']) && is_array($data['day']['events'])) $html .= self::day($data['day'],$a);
        elseif ($a['mode']==='pascha' && isset($data['pascha'])) $html.='<p class="oc-date">'.self::day_link($data['pascha'],self::date_label($data['pascha'])).'</p><div class="oc-detail"></div>';
        elseif ($a['mode']==='fasts' && isset($data['fastingPeriods'])) $html.='<ul class="oc-periods">'.self::periods($data['fastingPeriods']).'</ul>';
        elseif (in_array($a['mode'],['upcoming','feasts','memorial'],true) && isset($data['items'])) {
            $html .= '<div class="oc-upcoming">';
            foreach ($data['items'] as $item) {
                $days = (int)(new DateTimeImmutable($a['date']))->diff(new DateTimeImmutable($item['date']))->format('%a');
                $html .= '<article><span class="oc-eyebrow">'.esc_html(self::date_label($item['date'])).' · '.($days ? 'через '.$days.' дн.' : 'сегодня').'</span>'.self::day_link($item['date'],$item['event']['title']).'</article>';
            }
            $html .= empty($data['items']) ? '<p>В указанном диапазоне событий нет.</p>' : '';
            $html .= '</div><div class="oc-detail">'.($selected ? self::render(array_merge($a,['mode'=>'day']),true) : '').'</div>';
        } elseif (isset($data['days']) && is_array($data['days'])) {
            $html .= self::navigation($a);
            if ($a['mode']==='year') {
                $html .= '<p class="oc-pascha">Пасха · '.esc_html(self::date_label($data['pascha'])).'</p><div class="oc-year">';
                for ($m=1;$m<=12;$m++) $html .= self::month(array_values(array_filter($data['days'],static fn($day)=>(int)substr($day['date'],5,2)===$m)), $a, $m);
                $html .= '</div>';
                if (!empty($data['fastingPeriods'])) $html .= '<details><summary>Постные периоды</summary><ul>'.self::periods($data['fastingPeriods']).'</ul></details>';
            } else $html .= self::month($data['days'],$a,$a['month']);
            $html .= '<details class="oc-legend"><summary>Как читать календарь</summary><p>✦ — великий праздник. Красным выделены воскресенья и великие праздники. Маленькое число — дата по старому стилю. Выберите день, чтобы увидеть все памяти, знаки Типикона и правило поста.</p></details><div class="oc-detail">'.($selected || $a['mode']==='calendar' ? self::render(array_merge($a,['mode'=>'day']),true) : '').'</div>';
        } else $html .= self::error_html('API требует обновления: ожидаемые поля отсутствуют.');
        return $html.'<p class="oc-status" role="status" aria-live="polite"></p></section>';
    }
    static function date_label($date) {
        $months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
        return (int)substr($date,8,2).' '.$months[(int)substr($date,5,2)-1].' '.substr($date,0,4);
    }
    static function day_link($date,$label) {
        return '<a href="'.esc_url(self::date_url($date)).'" data-oc-date="'.esc_attr($date).'">'.esc_html($label).'</a>';
    }
    static function date_url($date) {
        $page=(int)self::options()['day_page'];$base=$page && get_post_status($page)==='publish'?get_permalink($page):false;
        return add_query_arg('orthocal_date',$date,$base);
    }
    static function navigation($a) {
        $year = $a['mode']==='year'; $date = new DateTimeImmutable(sprintf('%04d-%02d-01',$a['year'],$a['month']));
        $html = '<nav class="oc-nav" aria-label="Выбор периода">';
        foreach ([-1,1] as $step) {
            $target = $date->modify(($step<0?'-1':'+1').($year?' year':' month'));
            $disabled = (int)$target->format('Y')<1900 || (int)$target->format('Y')>2200;
            $html .= '<button type="button" data-oc-period="'.$target->format('Y-m-d').'" '.($disabled?'disabled':'').'>'.($step<0?'← Назад':'Вперёд →').'</button>';
        }
        $html .= '<label>Год <input data-oc-year type="number" min="1900" max="2200" value="'.$a['year'].'"></label><button type="button" data-oc-now>Сегодня</button></nav>';
        return $html;
    }
    static function month($days,$a,$month) {
        $months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
        $html = '<div class="oc-month"><h3>'.esc_html($months[$month-1].' '.$a['year']).'</h3><div class="oc-grid">';
        foreach (['Пн','Вт','Ср','Чт','Пт','Сб','Вс'] as $name) $html .= '<span class="oc-weekday">'.$name.'</span>';
        if ($days) for ($i=0;$i<(($days[0]['weekday']+6)%7);$i++) $html .= '<span aria-hidden="true"></span>';
        foreach ($days as $day) {
            $events = $day['events'] ?? []; $feasts = array_values(array_filter($events,static fn($e)=>$e['category']==='commemoration' && $e['typeCode']>=0 && $e['typeCode']<=2));
            $red = $day['weekday']===0 || count($feasts)>0; $today = $day['date']===wp_date('Y-m-d');
            $label = self::date_label($day['date']).'. '.($day['foodLabel'] ?? '').'. '.implode('. ',array_column($feasts,'title'));
            $html .= '<a class="oc-cell'.($red?' oc-red':'').($today?' oc-today':'').'" href="'.esc_url(self::date_url($day['date'])).'" data-oc-date="'.esc_attr($day['date']).'" aria-label="'.esc_attr($label).'" title="'.esc_attr($label).'"'.($today?' aria-current="date"':'').'>';
            $html .= '<b>'.(int)substr($day['date'],8,2).'</b>'.($a['oldstyle']==='1'?'<small>'.(int)substr($day['oldStyleDate'],8,2).'</small>':'');
            if ($feasts) $html .= '<span class="oc-star" aria-hidden="true">✦</span>';
            if ($a['mode']!=='year') $html .= '<span class="oc-cell-title">'.esc_html($feasts[0]['title'] ?? $events[0]['title'] ?? '').'</span><span class="oc-food">'.esc_html($day['foodLabel'] ?? '').'</span>';
            $html .= '</a>';
        }
        return $html.'</div></div>';
    }
    static function periods($periods) {
        $html='';
        foreach ($periods as $period) {
            if (!isset($period['label'],$period['start']['year'],$period['finish']['year'])) continue;
            $format = static fn($d) => sprintf('%04d-%02d-%02d',$d['year'],$d['month'],$d['day']);
            $html.='<li>'.esc_html($period['label'].' · '.self::date_label($format($period['start'])).' — '.self::date_label($format($period['finish']))).'</li>';
        }
        return $html;
    }
    static function event_level($code): string {
        $code=(int)$code;
        if($code<=1)return '0';
        if($code===2)return '1';
        if($code>=3&&$code<=5)return '2';
        if($code>=6&&$code<=8)return '3';
        return '4';
    }
    static function event_allowed($event,$levels): bool {
        if (!is_array($event) || ($event['category']??'')!=='commemoration') return false;
        $levels=array_values(array_filter(array_map('trim',explode(',',(string)$levels))));
        // An empty selection is treated as “all”, so an incomplete shortcode
        // can never make the whole holidays and memorials section disappear.
        return !$levels || in_array(self::event_level($event['typeCode']??-1),$levels,true);
    }
    static function day($day,$a) {
        $only=['fasting'=>'fasting','saints'=>'saints','readings'=>'readings','date'=>''];
        $sections=isset($only[$a['mode']])?[$only[$a['mode']]]:explode(',',$a['sections']);
        $hero = in_array('icons',$sections,true) ? self::hero_icon($day) : '';
        $html = $hero.'<div class="oc-day"><div class="oc-date-row"><p class="oc-date">'.esc_html(self::date_label($day['date'])).'</p>';
        if (in_array($a['mode'],['today','day'],true) && $a['show_picker']==='1') $html .= '<label class="oc-date-picker"><span class="screen-reader-text">Выбрать дату</span><input type="date" aria-label="Выбрать дату" title="Выбрать дату" data-oc-picker min="1900-01-01" max="2200-12-31" value="'.esc_attr($day['date']).'"></label>';
        $html .= '</div>';
        if ($a['oldstyle']==='1') $html .= '<p class="oc-muted">'.esc_html($day['oldStyleDate']).' по старому стилю</p>';
        $meta=[];if(!empty($day['weekdayName']))$meta[]=mb_strtolower((string)$day['weekdayName']);if(!empty($day['weekAfterPentecost']))$meta[]=(int)$day['weekAfterPentecost'].'-я седмица по Пятидесятнице';if(!empty($day['tone']))$meta[]='глас '.(int)$day['tone'];if($meta)$html.='<p class="oc-day-meta">'.esc_html(implode(' · ',$meta)).'</p>';
        if(in_array($a['mode'],['today','day'],true)) {
            $date=new DateTimeImmutable($day['date']);$html.=$a['show_nav']==='1'?'<nav class="oc-day-nav" aria-label="Выбор дня">':'';
            if($a['show_nav']==='1') foreach([-1=>'← Вчера',1=>'Завтра →'] as $step=>$label){$target=$date->modify(($step<0?'-1':'+1').' day')->format('Y-m-d');if(self::date_valid($target))$html.='<button type="button" data-oc-day="'.$target.'">'.($a['date']===wp_date('Y-m-d')?$label:($step<0?'← Предыдущий день':'Следующий день →')).'</button>';}
            $html.=$a['show_nav']==='1'?'</nav>':'';
        }
        if(in_array('saints',$sections,true)) {
            $events=array_values(array_filter($day['events'],static fn($event)=>self::event_allowed($event,$a['event_levels'])));
            usort($events,static function($left,$right){$rank=static function($event){$title=(string)($event['title']??'');$monk=preg_match('/^(?:прп\.|преподобн)/iu',$title)?0:1;return [$monk,(int)($event['typeCode']??99),$title];};return $rank($left)<=>$rank($right);});
            $html.='<section class="oc-saints-section">'.($a['show_section_titles']==='1'?'<h3>Праздники и памяти</h3>':'').($a['show_search']==='1'?'<label class="oc-search">Найти в памятях дня <input type="search" data-oc-event-search placeholder="Имя или название"></label>':'').'<ul class="oc-events">';
            foreach ($events as $event) {
                $mark=$event['typikonMark'] ?? null;
                $html .= '<li'.(($event['typeCode']>=0 && $event['typeCode']<=2)?' class="oc-red"':'').'>';
                $local=$a['images']==='1'&&$mark?Orthocal_Media_Cache::url($mark['svgSource']??''):'';
                // A saint's rank is supplied solely by the calendar API. The former
                // decorative cross for every venerable saint resembled the red
                // polyeleos sign and falsely elevated ordinary commemorations.
                if ($local) $html .= '<img width="20" height="20" src="'.esc_url($local).'" alt="'.esc_attr($mark['label'] ?? 'Знак Типикона').'" title="'.esc_attr($mark['label']??'Знак Типикона').'"> ';
                $html .= esc_html($event['title']).'</li>';
            }
            $html .= '</ul><p data-oc-no-events hidden>Совпадений нет.</p></section>';
        }
        if (in_array('fasting',$sections,true)) {
            $foodImage='';$markers=$day['foodMarkers']??[];$selected=array_values(array_filter($markers,static fn($marker)=>$marker['packId']===$a['image_pack']));
            $foodSource=$selected[0]['source']??$markers[0]['source']??'';
            $local=$a['images']==='1'?Orthocal_Media_Cache::url($foodSource):'';
            if ($local) $foodImage='<img src="'.esc_url($local).'" width="44" height="44" alt="">';
            $profileLabel=$a['profile']==='parish'?'Приходской':'Монастырский';
            $html .= '<section class="oc-fasting-section">'.($a['show_section_titles']==='1'?'<h3>Пост и трапеза</h3>':'').'<p class="oc-fast">'.$foodImage.esc_html($day['foodLabel'] ?? '').'<sup class="oc-profile-mark" aria-label="'.$profileLabel.'">*</sup></p></section>';
        }
        if(in_array('icons',$sections,true))$html.=self::icons_slot($day,$a['icon_limit']);
        $psalter=array_values(array_filter($day['events'],static fn($e)=>(int)($e['typeCode']??0)===302));
        $readings=array_values(array_filter($day['events'],static fn($e)=>$e['category']==='scripture-reading'&&(int)($e['typeCode']??0)!==302));
        if (($readings || $psalter) && in_array('readings',$sections,true)) {
            $html .= '<div class="oc-readings">'.($a['show_section_titles']==='1'?'<h3>Библейские чтения</h3>':'').'<label class="oc-reading-translation">Перевод <select data-oc-translation><option value="">Загрузить переводы…</option></select></label>'.($a['show_font_size']==='1'?'<label class="oc-reading-font">Размер текста <input data-oc-font type="range" min="16" max="30" value="19"></label>':'').'<p class="oc-muted">Текст Апостола и Евангелия открывается по выбранному переводу. Псалтирь приведена по богослужебному распределению дня.</p>';
            foreach ($readings as $event) $html .= '<details data-oc-reading="'.esc_attr(wp_json_encode($event['reading'] ?? null)).'"><summary>'.esc_html($event['title']).'</summary><div class="oc-reading-body"><button type="button" data-oc-copy-reading>Скопировать текст</button><div class="oc-verses" aria-live="polite"></div></div></details>';
            foreach ($psalter as $event) {
                $parts=array_values(array_filter(array_map('trim',explode(';',(string)($event['title']??'')))));
                if (!$parts) continue;
                $vespers=count($parts)>=3?array_pop($parts):null;
                $html.='<section class="oc-psalter"><h4>Псалтирь</h4><p><strong>На утрене:</strong> '.esc_html(implode('; ',$parts)).'</p>';
                if ($vespers!==null) $html.='<p><strong>На вечерне:</strong> '.esc_html($vespers).'</p>';
                $html.='</section>';
            }
            $html .= '</div>';
        } elseif ($a['mode']==='readings') $html .= '<p>В источнике нет чтений для этой даты.</p>';
        if(in_array('texts',$sections,true)) {
            $html.='<section class="oc-texts-section">'.($a['show_section_titles']==='1'?'<h3>Богослужебные тексты</h3>':'');
            $html.='<p class="oc-muted">Откройте справочник и выберите нужный текст.</p><div class="oc-text-buttons">';foreach(['troparia'=>'Тропари','kontakia'=>'Кондаки','prayers'=>'Молитвы','magnifications'=>'Величания','horologion'=>'Часослов'] as $mode=>$label)$html.='<button type="button" data-oc-library="'.$mode.'">'.$label.'</button>';$html.='</div></section>';
        }
        $profileLabel=$a['profile']==='parish'?'Приходской':'Монастырский';
        return $html.($a['show_copy']==='1'?'<p class="oc-permalink">'.self::day_link($day['date'],'Ссылка на этот день').' <button type="button" data-oc-copy-link>Скопировать ссылку</button> <small class="oc-profile-note">* '.$profileLabel.' профиль</small></p>':'<p class="oc-profile-note">* '.$profileLabel.' профиль</p>').'</div>';
    }
    static function icons_slot($day,$limit='all') {
        // The API is the source of truth: show every icon it supplies for the day.
        $items=[];
        foreach (($day['icons']??[]) as $icon) if(is_array($icon)&&!empty($icon['imageUrl'])) $items[]=['localUrl'=>Orthocal_Media_Cache::url($icon['imageUrl']),'alt'=>$icon['title']??'Икона','description'=>$icon['description']??$icon['caption']??'','attribution'=>$icon['attribution']??''];
        $items=array_merge($items,apply_filters('orthocal_day_icons',[],$day));
        $html='';$upload=wp_upload_dir();
        $items=is_array($items)?$items:[];
        $items=array_slice($items,1);
        if($limit!=='all')$items=array_slice($items,0,max(0,(int)$limit-1));
        foreach($items as $item) {
            if(!is_array($item)||empty($item['localUrl'])||empty($item['alt'])||!str_starts_with($item['localUrl'],$upload['baseurl'].'/orthocal-cache/'))continue;
            $name=substr($item['localUrl'],strlen($upload['baseurl'].'/orthocal-cache/'));
            if(!Orthocal_Media_Cache::file_valid($name)||!is_file($upload['basedir'].'/orthocal-cache/'.$name))continue;
            $description=$item['description']??$item['caption']??$item['alt'];
            $html.='<figure><a href="'.esc_url($item['localUrl']).'" data-oc-icon data-oc-icon-title="'.esc_attr($item['alt']).'" data-oc-icon-description="'.esc_attr($description).'" aria-label="Открыть икону: '.esc_attr($item['alt']).'"><img loading="lazy" src="'.esc_url($item['localUrl']).'" alt="'.esc_attr($item['alt']).'"></a><figcaption>'.esc_html($item['alt']).(!empty($item['attribution'])?' · '.esc_html($item['attribution']):'').'</figcaption></figure>';
        }
        return $html?'<div class="oc-icons">'.$html.'</div>':'';
    }
    static function hero_icon($day) {
        $icon=$day['icons'][0]??null;
        if(!is_array($icon)||empty($icon['imageUrl']))return '';
        $url=Orthocal_Media_Cache::url($icon['imageUrl']);$title=$icon['title']??'Икона';$description=$icon['description']??$icon['caption']??'';
        return '<div class="oc-hero-icon"><a href="'.esc_url($url).'" data-oc-icon data-oc-icon-title="'.esc_attr($title).'" data-oc-icon-description="'.esc_attr($description).'" aria-label="Открыть икону: '.esc_attr($title).'" ><img src="'.esc_url($url).'" alt="'.esc_attr($title).'" loading="lazy"></a></div>';
    }
    static function texts($data,$a) {
        $html='<p class="oc-muted">Справочная библиотека · церковнославянский текст. Выбор по гласу или дню недели не является указанием порядка конкретной службы.</p><div class="oc-text-filters"><label>Раздел <select data-oc-text-filter="scope">';
        foreach([''=>'Все разделы','resurrection'=>'Воскресные','weekday'=>'Дни седмицы','common'=>'Общие и справочные'] as $value=>$label)$html.='<option value="'.$value.'" '.selected($a['scope'],$value,false).'>'.$label.'</option>';
        $html.='</select></label><label>Глас <select data-oc-text-filter="tone"><option value="">Все гласы</option>';
        for($i=1;$i<=8;$i++)$html.='<option value="'.$i.'" '.selected((string)$a['tone'],(string)$i,false).'>'.$i.'</option>';
        $html.='</select></label></div>';
        foreach($data['texts'] as $text) {
            $html.='<details class="oc-liturgical-text"><summary>'.esc_html($text['title']).'</summary><div class="oc-reading-body"><button type="button" data-oc-copy-reading>Скопировать текст</button><div class="oc-verses" lang="cu">'.nl2br(esc_html($text['text'])).'</div><p class="oc-text-source">';
            foreach($text['sources']??[] as $source)$html.='<a href="'.esc_url($source['url']).'" target="_blank" rel="noopener noreferrer">'.esc_html($source['title']).'</a> ';
            $html.='</p></div></details>';
        }
        return $html.(empty($data['texts'])?'<p>В этой части библиотеки пока нет текстов с выбранными параметрами.</p>':'');
    }
    static function service($data,$a) {
        $offices=['horologion'=>'Общие молитвы','first-hour'=>'Первый час','third-hour'=>'Третий час','sixth-hour'=>'Шестой час','ninth-hour'=>'Девятый час','matins'=>'Утреня','vespers'=>'Вечерня'];
        $office=$data['office']??$a['office']; $officeLabel=$offices[$office]??'Часослов';
        $html='<section class="oc-horologion"><header class="oc-service-header"><span class="oc-eyebrow">Часослов</span><h3>'.esc_html($officeLabel).'</h3><p>Молитвы и тексты дня на '.esc_html(self::date_label($data['date']??$a['date'])).'.</p></header><div class="oc-service-controls"><label>Язык календаря <select data-oc-service-lang><option value="ru" '.selected($a['lang'],'ru',false).'>Русский</option><option value="cu" '.selected($a['lang'],'cu',false).'>Церковнославянский</option><option value="de" '.selected($a['lang'],'de',false).'>Deutsch</option><option value="uk" '.selected($a['lang'],'uk',false).'>Українська</option><option value="pl" '.selected($a['lang'],'pl',false).'>Polski</option></select></label><label>Раздел <select data-oc-service-office><option value="horologion" '.selected($office,'horologion',false).'>Общие молитвы</option><option value="first-hour" '.selected($office,'first-hour',false).'>Первый час</option><option value="third-hour" '.selected($office,'third-hour',false).'>Третий час</option><option value="sixth-hour" '.selected($office,'sixth-hour',false).'>Шестой час</option><option value="ninth-hour" '.selected($office,'ninth-hour',false).'>Девятый час</option><option value="matins" '.selected($office,'matins',false).'>Утреня</option><option value="vespers" '.selected($office,'vespers',false).'>Вечерня</option></select></label></div>';
        $assignments=$data['assignments']??[];
        if ($assignments) {
            $html.='<section class="oc-service-section"><h4>Тексты дня</h4>';
            foreach ($assignments as $item) $html.='<article class="oc-service-prayer"><h5>'.esc_html($item['title']??'Текст службы').'</h5><div class="oc-service-text" lang="cu">'.nl2br(esc_html($item['text']??'')).'</div></article>';
            $html.='</section>';
        }
        $expansions=$data['expansions']??[];
        if ($expansions) {
            $html.='<section class="oc-service-section"><h4>Общие молитвы</h4>';
            foreach ($expansions as $item) $html.='<article class="oc-service-prayer"><h5>'.esc_html($item['title']??$item['label']??'Молитва').'</h5><div class="oc-service-text" lang="cu">'.nl2br(esc_html($item['text']??'')).'</div></article>';
            $html.='</section>';
        }
        if (!$assignments && !$expansions) $html.='<p class="oc-message">Для выбранного раздела пока нет текстов.</p>';
        return $html.'</section>';
    }
    static function throttle() {
        // Bound public proxy traffic. No forwarded headers or arbitrary upstream URL accepted.
        foreach (['global'=>300, hash('sha256',($_SERVER['REMOTE_ADDR'] ?? '').wp_salt())=>40] as $id=>$max) {
            $key='oc_rate_'.md5($id.gmdate('YmdHi')); $count=(int)get_transient($key);
            if ($count >= $max) return new WP_Error('rate_limit','Слишком много запросов. Повторите через минуту.',['status'=>429]);
            set_transient($key,$count+1,70);
        }
        return true;
    }
    static function rest_render($request) {
        $rate=self::throttle(); if (is_wp_error($rate)) return $rate;
        $attrs=$request->get_query_params();
        foreach ($attrs as $value) if (!is_scalar($value)) return new WP_Error('invalid','Неверные параметры.',['status'=>400]);
        $a=self::config($attrs); if (is_wp_error($a)) return new WP_Error('invalid',$a->get_error_message(),['status'=>400]);
        $response=new WP_REST_Response(['html'=>self::render($attrs,true)]); $response->header('Cache-Control','no-store'); return $response;
    }
    static function rest_bible($request) {
        $rate=self::throttle(); if (is_wp_error($rate)) return $rate;
        $path=$request->get_param('path');
        if (!is_string($path) || !preg_match('~^translations(?:/[a-zA-Z0-9_-]{1,80}/books(?:/[a-zA-Z0-9_-]{1,100}/chapters/[1-9][0-9]{0,2})?)?$~D',$path)) return new WP_Error('path','Неверный путь.',['status'=>400]);
        $data=self::request('bible',$path); if (is_wp_error($data)) return $data;
        // BibleDesktop v1 wraps every API payload in {data: ...}; the browser contract stays flat.
        if (isset($data['data']) && is_array($data['data'])) $data=$data['data'];
        $response=new WP_REST_Response($data); $response->header('Cache-Control','no-store'); return $response;
    }
    static function settings_page() { Orthocal_Admin::page(); }
}
