<?php
if (!defined('ABSPATH')) exit;

/** Full Bible Desktop works, kept separate from calendar assignments. */
final class Orthocal_Library {
    const LANGUAGES = ['ru'=>'Русский','cu'=>'Церковнославянский','cu-civil'=>'Церковнославянский — гражданский шрифт','de'=>'Deutsch','pl'=>'Polski','uk'=>'Українська'];

    static function language($a) { return ($a['text_language'] ?? '') ?: $a['lang']; }

    static function language_control($a) {
        $html='<label>'.esc_html(Orthocal_Plugin::ui('Язык текста',$a['lang'])).' <select data-oc-library-language>';
        foreach(self::LANGUAGES as $code=>$label)$html.='<option value="'.esc_attr($code).'" '.selected(self::language($a),$code,false).'>'.esc_html($label).'</option>';
        return $html.'</select></label>';
    }

    static function data($a) {
        $language=self::language($a);
        $collection=$a['mode']==='horologion'?'horologion':($a['mode']==='prayers'?'prayers':(in_array($a['mode'],['troparia','kontakia'],true)?($language==='de'?'hymnography':'horologion-appendix'):$a['mode']));
        $catalog=Orthocal_Plugin::request('bible','liturgical/works',['collection'=>$collection]);
        if(is_wp_error($catalog))return $catalog;
        $works=array_values(array_filter($catalog['data']??[],static fn($work)=>in_array($language,$work['available_languages']??[],true)));
        if(in_array($a['mode'],['troparia','kontakia'],true)&&$language!=='de')$works=array_values(array_filter($works,static fn($work)=>str_starts_with($work['slug'],'tropari-i-kondaki-')));
        $slug=$a['work']??'';
        $selected=null;
        foreach($works as $work)if($work['slug']===$slug)$selected=$work;
        if(!$selected && $slug==='') {
            $offices=['horologion'=>'horologion-vosstav-ot-sna','first-hour'=>'horologion-cas-pervyi','third-hour'=>'horologion-cas-tretii','sixth-hour'=>'horologion-cas-sestoi','ninth-hour'=>'horologion-cas-deviatyi','matins'=>'horologion-utrenia','vespers'=>'horologion-vecernia','compline'=>'horologion-maloe-povecerie','typica'=>'horologion-posledovanie-izobrazitelnyx'];
            foreach($works as $work)if($work['slug']===($offices[$a['office']]??''))$selected=$work;
            $selected??=$works[0]??null;
        }
        $version=null;
        if($selected) {
            $response=Orthocal_Plugin::request('bible','liturgical/works/'.rawurlencode($selected['slug']).'/versions/'.rawurlencode($language));
            if(is_wp_error($response))return $response;
            $version=$response['data']??null;
            if(($version['language']??null)!==$language)return new WP_Error('language','Источник вернул другую языковую версию.');
        }
        return ['library'=>true,'works'=>$works,'version'=>$version,'language'=>$language];
    }

    static function render($data,$a) {
        $html='<div class="oc-service-controls">'.self::language_control($a);
        if($data['works']) {
            $html.='<label>'.esc_html(Orthocal_Plugin::ui('Раздел',$a['lang'])).' <select data-oc-library-work>';
            foreach($data['works'] as $work)$html.='<option value="'.esc_attr($work['slug']).'" '.selected($data['version']['slug']??'',$work['slug'],false).'>'.esc_html($work['title']).'</option>';
            $html.='</select></label>';
        }
        $html.='</div>';
        $version=$data['version'];
        if(!$version)return $html.'<p class="oc-message">'.esc_html(Orthocal_Plugin::ui('На выбранном языке текст пока не добавлен.',$a['lang'])).'</p>'.self::sources($a);
        $traditional=($version['orthography']??'')==='traditional';
        $html.='<article class="oc-reading-body oc-library-reader"><h3>'.esc_html($version['title']).'</h3><button type="button" data-oc-copy-reading>'.esc_html(Orthocal_Plugin::ui('Скопировать текст',$a['lang'])).'</button><div class="oc-verses oc-library-content" lang="'.esc_attr($data['language']==='cu-civil'?'cu':$data['language']).'" data-orthography="'.($traditional?'traditional':'civil').'">';
        foreach($version['blocks']??[] as $index=>$block) {
            if($index===0 && ($block['kind']??'')==='heading' && trim($block['text']??'')===trim($version['title']))continue;
            $tag=($block['kind']??'')==='heading'?'h4':'p';
            $html.='<'.$tag.(($block['kind']??'')==='rubric'?' class="oc-service-rubric"':'').'>';
            if(!empty($block['segments']))foreach($block['segments'] as $segment)$html.='<span'.(!empty($segment['rubric'])?' class="oc-service-rubric"':'').'>'.nl2br(esc_html($segment['text'])).'</span>';
            else $html.=nl2br(esc_html($block['text']??''));
            $html.='</'.$tag.'>';
        }
        return $html.'</div><p class="oc-text-source"><a href="'.esc_url($version['source_url']??'').'" target="_blank" rel="noopener noreferrer">'.esc_html($version['credit']??'Источник').'</a></p></article>';
    }

    static function sources($a) {
        $links=self::language($a)==='de'?['Orthodoxes Gebetbuch'=>'https://orthodoxia.de/gebete/gebetbuch']: (self::language($a)==='pl'?['Modlitwy prawosławne'=>'https://liturgia.cerkiew.pl/page.php?id=14']:[]);
        $html='';foreach($links as $title=>$url)$html.='<p><a href="'.esc_url($url).'" target="_blank" rel="noopener noreferrer">'.esc_html($title).' ↗</a></p>';
        return $html;
    }
}
