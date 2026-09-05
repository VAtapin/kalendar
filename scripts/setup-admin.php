<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if (function_exists('posix_geteuid') && posix_geteuid() === 0) {
    fwrite(STDERR, "Запустите под пользователем сайта, не root.\n"); exit(1);
}
if (PHP_OS_FAMILY === 'Windows' || !function_exists('shell_exec')) {
    fwrite(STDERR, "Запустите эту команду в SSH-терминале Linux сервера.\n"); exit(1);
}
$terminalMode = trim((string) shell_exec('stty -g 2>/dev/null'));
if ($terminalMode === '' || !preg_match('/^[0-9a-fA-F:]+$/', $terminalMode)) {
    fwrite(STDERR, "Нужен интерактивный SSH-терминал для скрытого ввода пароля.\n"); exit(1);
}
$envFile = dirname(__DIR__) . '/.env';
if (!is_file($envFile) || !is_writable($envFile)) {
    fwrite(STDERR, "Рабочий .env не найден или недоступен для записи.\n"); exit(1);
}
echo "Логин администратора [admin]: ";
$login = trim((string) fgets(STDIN));
if ($login === '') $login = 'admin';
if (!preg_match('/^[a-zA-Z0-9._-]{3,64}$/', $login)) {
    fwrite(STDERR, "Логин: 3–64 латинские буквы, цифры, точка, дефис или подчёркивание.\n"); exit(1);
}
try {
    shell_exec('stty -echo');
    echo "Новый пароль (12–72 байта, ввод скрыт): ";
    $password = rtrim((string) fgets(STDIN), "\r\n");
    echo "\nПовторите пароль: ";
    $repeat = rtrim((string) fgets(STDIN), "\r\n");
    echo "\n";
} finally { shell_exec('stty ' . $terminalMode); }
if ($password !== $repeat || strlen($password) < 12 || strlen($password) > 72) {
    fwrite(STDERR, "Пароли должны совпадать; длина — от 12 до 72 байт. Ничего не изменено.\n"); exit(1);
}
$hash = password_hash($password, PASSWORD_DEFAULT);
$password = $repeat = '';
$original = file_get_contents($envFile);
if ($original === false) throw new RuntimeException('Cannot read .env');
$updated = preg_replace('/^[\t ]*(?:export[\t ]+)?(?:ADMIN_LOGIN|ADMIN_PASSWORD_HASH)[\t ]*=.*(?:\r?\n|$)/m', '', $original);
$updated = rtrim($updated) . "\nADMIN_LOGIN=" . $login . "\nADMIN_PASSWORD_HASH=" . $hash . "\n";
$backup = $envFile . '.admin-backup-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3));
$temporary = tempnam(dirname($envFile), '.admin-env-');
if ($temporary === false) throw new RuntimeException('Cannot create temporary configuration');
chmod($temporary, 0600);
// Both the backup and replacement stay above the public document root.
$backupHandle = fopen($backup, 'x');
if ($backupHandle === false) throw new RuntimeException('Cannot create backup');
chmod($backup, 0600);
if (fwrite($backupHandle, $original) !== strlen($original)) throw new RuntimeException('Cannot write backup');
fclose($backupHandle);
if (file_put_contents($temporary, $updated) !== strlen($updated) || !rename($temporary, $envFile)) {
    throw new RuntimeException('Cannot save administrator configuration');
}
chmod($envFile, 0600);
echo "Готово. Логин: {$login}. Пароль хранится только как хеш.\n";
echo "Откройте Файл → Администратор и войдите. SMTP не изменён.\n";
echo "Резервная копия .env: {$backup}\n";
