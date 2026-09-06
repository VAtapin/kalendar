<?php
declare(strict_types=1);

trait CalendarAdminAuth
{
    public function adminLogin(string $login, string $password, string $address): string
    {
        $expectedLogin = calendar_config_value('ADMIN_LOGIN');
        $passwordHash = calendar_config_value('ADMIN_PASSWORD_HASH');
        if ($expectedLogin === '' || $passwordHash === '') calendar_fail('admin_not_configured', 503, 'Вход администратора ещё не настроен. Выполните php scripts/setup-admin.php на сервере.');
        return calendar_with_lock($this->locksDirectory, 'admin-auth', function () use ($login, $password, $address, $expectedLogin, $passwordHash): string {
            $file = $this->dataDirectory . '/admin-auth.json';
            $state = calendar_read_json_file($file, ['attempts' => [], 'sessions' => []]);
            $now = time();
            $state['attempts'] = array_filter($state['attempts'], static fn ($entry) => ($entry['at'] ?? 0) > time() - 900);
            $key = calendar_hash($address);
            $attempt = $state['attempts'][$key] ?? ['failures' => 0, 'until' => 0];
            if ($attempt['until'] > $now) calendar_fail('admin_login_wait', 429, 'Повторите вход через ' . ($attempt['until'] - $now) . ' сек.');
            $passwordValid = password_verify($password, $passwordHash);
            if (!$passwordValid || !hash_equals($expectedLogin, $login)) {
                $failures = min(10, $attempt['failures'] + 1);
                $state['attempts'][$key] = ['failures' => $failures, 'at' => $now, 'until' => $now + ($failures < 5 ? 0 : min(60, 2 ** ($failures - 4)))];
                calendar_atomic_json_write($file, $state);
                calendar_fail('admin_login_invalid', 401, 'Неверный логин или пароль');
            }
            unset($state['attempts'][$key]);
            $state['sessions'] = array_filter($state['sessions'], static fn ($entry) => $entry['expires'] > time());
            $token = calendar_token();
            $state['sessions'][calendar_hash($token)] = ['expires' => $now + 43200,
                'fingerprint' => calendar_hash($expectedLogin . ':' . $passwordHash)];
            calendar_atomic_json_write($file, $state);
            return $token;
        });
    }

    public function adminAuthenticated(string $token): bool
    {
        if ($token === '' || strlen($token) > 200) return false;
        $login = calendar_config_value('ADMIN_LOGIN');
        $passwordHash = calendar_config_value('ADMIN_PASSWORD_HASH');
        if ($login === '' || $passwordHash === '') return false;
        $state = calendar_read_json_file($this->dataDirectory . '/admin-auth.json', []);
        $entry = $state['sessions'][calendar_hash($token)] ?? null;
        return is_array($entry) && $entry['expires'] > time()
            && hash_equals($entry['fingerprint'], calendar_hash($login . ':' . $passwordHash));
    }

    public function adminLogout(string $token): void
    {
        calendar_with_lock($this->locksDirectory, 'admin-auth', function () use ($token): void {
            $file = $this->dataDirectory . '/admin-auth.json';
            $state = calendar_read_json_file($file, ['attempts' => [], 'sessions' => []]);
            unset($state['sessions'][calendar_hash($token)]);
            calendar_atomic_json_write($file, $state);
        });
    }
}

function calendar_admin_cookie_name(): string { return 'calendar_admin_session'; }
function calendar_admin_cookie_token(): string {
    return is_string($_COOKIE[calendar_admin_cookie_name()] ?? null) ? $_COOKIE[calendar_admin_cookie_name()] : '';
}
function calendar_admin_cookie(string $token): void {
    setcookie(calendar_admin_cookie_name(), $token, ['expires' => $token === '' ? time() - 3600 : time() + 43200,
        'path' => '/api', 'secure' => str_starts_with(calendar_config_value('APP_PUBLIC_URL'), 'https://'),
        'httponly' => true, 'samesite' => 'Strict']);
}
function calendar_admin_check_origin(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $url = parse_url(calendar_config_value('APP_PUBLIC_URL'));
    $expected = isset($url['scheme'], $url['host']) ? $url['scheme'] . '://' . $url['host'] . (isset($url['port']) ? ':' . $url['port'] : '') : '';
    $allowed = [$expected];
    $aliases = ['https://kalender.georg-kloster.ru', 'https://kalender.georg-kloster.de'];
    if (in_array($expected, $aliases, true)) $allowed = $aliases;
    if ($expected === '' || !in_array($origin, $allowed, true)) calendar_fail('invalid_origin', 403, 'Обновите страницу и повторите действие');
}
