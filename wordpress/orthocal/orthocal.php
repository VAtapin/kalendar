<?php
/**
 * Plugin Name: Православный календарь — Календарная мастерская
 * Description: Сегодня, праздники, месяц, год и библейские чтения через API календаря и BibleDesktop.
 * Version: 1.2.0
 * Requires at least: 6.3
 * Requires PHP: 8.0
 * License: GPL-2.0-or-later
 * Text Domain: orthocal
 */
if (!defined('ABSPATH')) exit;
require_once __DIR__ . '/includes/media-cache.php';
require_once __DIR__ . '/includes/admin.php';
require_once __DIR__ . '/includes/plugin.php';
Orthocal_Plugin::boot(__FILE__);
