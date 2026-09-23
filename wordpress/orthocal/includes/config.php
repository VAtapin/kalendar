<?php
if (!defined('ABSPATH')) exit;

final class Orthocal_Config {
    const DEFAULT_CALENDAR_ORIGIN = 'https://kalender.georg-kloster.ru';

    static function calendar_origin() {
        $origin = defined('ORTHOCAL_API_ORIGIN') ? (string) ORTHOCAL_API_ORIGIN : self::DEFAULT_CALENDAR_ORIGIN;
        $origin = (string) apply_filters('orthocal_api_origin', $origin);
        $origin = untrailingslashit(trim($origin));
        $parts = wp_parse_url($origin);
        if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])
            || isset($parts['user'], $parts['pass'], $parts['query'], $parts['fragment'])
            || !empty($parts['path'])) {
            return self::DEFAULT_CALENDAR_ORIGIN;
        }
        return $origin;
    }

    static function calendar_url($path = '') {
        return self::calendar_origin() . ($path === '' ? '' : '/' . ltrim((string) $path, '/'));
    }
}
