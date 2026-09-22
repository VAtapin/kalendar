<?php

declare(strict_types=1);

/** Build PDF/X-1a directly from opaque page images and a CMYK output profile. */
function calendar_build_print_pdf(string $source, string $destination, string $profile, string $profileName): int
{
    $runtimeDirectory = is_file(__DIR__ . '/calendar-runtime.json') ? __DIR__ : calendar_project_root() . '/dist/api';
    $manifest = calendar_read_json_file($runtimeDirectory . '/calendar-runtime.json', null);
    $node = calendar_config_value('CALENDAR_NODE_BINARY', is_array($manifest) ? (string) ($manifest['nodeBinary'] ?? '') : '');
    $builder = calendar_project_root() . '/scripts/build-print-pdf.mjs';
    if ($node === '' || !is_file($node) || !is_file($builder)) {
        calendar_fail('print_runtime_unavailable', 503, 'Node.js 22 для печатного PDF недоступен');
    }
    $command = [$node, '--max-old-space-size=768', $builder, $source, $profile, $destination, $profileName];
    $process = @proc_open($command, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes,
        calendar_project_root(), null, ['bypass_shell' => true, 'suppress_errors' => true]);
    if (!is_resource($process)) calendar_fail('print_runtime_unavailable', 503, 'Не удалось запустить печатный экспорт');
    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);
    $messages = '';
    $deadline = microtime(true) + 300;
    $exitCode = -1;
    try {
        do {
            $messages = substr($messages . stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]), -4096);
            $status = proc_get_status($process);
            if (!$status['running']) {
                $exitCode = $status['exitcode'];
                break;
            }
            if (microtime(true) > $deadline) {
                proc_terminate($process);
                break;
            }
            usleep(100000);
        } while (true);
    } finally {
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);
    }
    if ($exitCode !== 0 || !is_file($destination) || file_get_contents($destination, false, null, 0, 8) !== '%PDF-1.3') {
        @unlink($destination);
        error_log('Calendar direct print PDF failed: ' . $messages);
        calendar_fail('pdf_conversion_failed', 500, 'Не удалось создать PDF/X-1a:2001 из страниц календаря');
    }
    $size = filesize($destination);
    if ($size === false || $size <= 0) calendar_fail('pdf_conversion_failed', 500, 'Создан пустой печатный PDF');
    return $size;
}
