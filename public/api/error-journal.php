<?php
declare(strict_types=1);

/** Only diagnostic metadata: never bodies, query strings, cookies or exception messages. */
function calendar_error_record(array $details): void
{
    $directory = $GLOBALS['calendar_error_directory'] ?? null;
    if (!is_string($directory)) return;
    $lock = @fopen($directory . '/errors.lock', 'c');
    if ($lock === false) return;
    @chmod($directory . '/errors.lock', 0600);
    if (!flock($lock, LOCK_EX)) { fclose($lock); return; }
    try {
        $file = $directory . '/errors.jsonl';
        clearstatcache(true, $file);
        if (is_file($file) && filesize($file) >= 5 * 1024 * 1024) {
            if (is_file($file . '.1')) @unlink($file . '.1');
            @rename($file, $file . '.1');
        }
        $method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
        $entry = ['at' => gmdate('c'), 'requestId' => $GLOBALS['calendar_error_request_id'],
            'method' => in_array($method, ['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS','CLI'], true) ? $method : 'OTHER'];
        if (@file_put_contents($file, json_encode($entry + $details, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) . "\n", FILE_APPEND) === false) {
            error_log('Calendar error journal: cannot append diagnostic');
        }
        @chmod($file, 0600);
    } finally { flock($lock, LOCK_UN); fclose($lock); }
}

function calendar_error_exception(Throwable $error): array
{
    return ['exception' => get_class($error), 'file' => basename($error->getFile()), 'line' => $error->getLine()];
}

function calendar_install_error_journal(string $dataDirectory): void
{
    $directory = $dataDirectory . '/logs';
    if (!is_dir($directory) && !@mkdir($directory, 0700, true) && !is_dir($directory)) {
        error_log('Calendar error journal: cannot create private log directory');
        return;
    }
    $GLOBALS['calendar_error_directory'] = $directory;
    $GLOBALS['calendar_error_request_id'] = bin2hex(random_bytes(8));
    header('X-Calendar-Request-Id: ' . $GLOBALS['calendar_error_request_id']);
    set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
        if (error_reporting() & $severity) calendar_error_record(['kind' => 'php', 'severity' => $severity, 'file' => basename($file), 'line' => $line]);
        return false; // Preserve PHP's existing error handling and server journal.
    });
    // Free reserved memory before logging an out-of-memory fatal error.
    $reserve = str_repeat('x', 256 * 1024);
    register_shutdown_function(static function () use (&$reserve): void {
        $reserve = '';
        $error = error_get_last();
        if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
            calendar_error_record(['kind' => 'fatal', 'severity' => $error['type'], 'file' => basename($error['file']), 'line' => $error['line'],
                'code' => str_contains($error['message'], 'Allowed memory size') ? 'memory_exhausted' : 'php_fatal',
                'memoryLimit' => ini_get('memory_limit')]);
        }
    });
}

/** Prevent unauthenticated client reports from filling the disk. */
function calendar_accept_client_error(string $address): bool
{
    $directory = $GLOBALS['calendar_error_directory'] ?? null;
    if (!is_string($directory)) return false;
    return calendar_with_lock($directory, 'client-error-rate', static function () use ($directory, $address): bool {
        $file = $directory . '/client-error-rate.json';
        $limits = calendar_read_json_file($file, []);
        $minute = intdiv(time(), 60);
        $limits = array_filter($limits, static fn($item) => $item['minute'] === $minute);
        $key = hash('sha256', $address);
        if (($limits[$key]['count'] ?? 0) >= 30 || (!isset($limits[$key]) && count($limits) >= 1000)) return false;
        $limits[$key] = ['minute' => $minute, 'count' => ($limits[$key]['count'] ?? 0) + 1];
        calendar_atomic_json_write($file, $limits);
        return true;
    });
}
