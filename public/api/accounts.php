<?php
declare(strict_types=1);

trait CalendarAccounts
{
    private function accountState(): array {
        return calendar_read_json_file($this->dataDirectory . '/accounts.json', ['users' => [], 'sessions' => [], 'links' => [], 'attempts' => []]);
    }
    private function writeAccounts(array $state): void { calendar_atomic_json_write($this->dataDirectory . '/accounts.json', $state); }
    public function accountEmailLink(string $email, bool $subscribe): array {
        $verification = $this->createEmailVerification($email, $subscribe, false);
        calendar_with_lock($this->locksDirectory, 'accounts', function () use ($verification): void {
            $state = $this->accountState();
            $state['links'] = array_filter($state['links'], static fn($link) => $link > time());
            $state['links'][calendar_hash($verification['token'])] = time() + 1800;
            $this->writeAccounts($state);
        });
        return $verification;
    }
    private function newAccountSession(array &$state, string $email): string {
        $state['sessions'] = array_filter($state['sessions'], static fn($session) => $session['expires'] > time());
        $token = calendar_token();
        $state['sessions'][calendar_hash($token)] = ['email' => $email, 'version' => $state['users'][$email]['version'], 'expires' => time() + 2592000];
        return $token;
    }
    public function accountSetPassword(string $token, string $password): string {
        if (strlen($password) < 12 || strlen($password) > 72) calendar_fail('invalid_password', 400, 'Пароль: от 12 до 72 байт');
        $hash = password_hash($password, PASSWORD_DEFAULT);
        return calendar_with_lock($this->locksDirectory, 'accounts', function () use ($token, $hash): string {
            $state = $this->accountState(); $key = calendar_hash($token);
            if (($state['links'][$key] ?? 0) <= time()) calendar_fail('invalid_link', 400, 'Ссылка уже использована или устарела');
            $confirmed = $this->confirmEmailVerification($token);
            $email = $confirmed['email'];
            $existing = $state['users'][$email] ?? null;
            if ($existing['blocked'] ?? false) calendar_fail('account_blocked', 403, 'Учётная запись заблокирована');
            $state['users'][$email] = ['id' => $existing['id'] ?? calendar_uuid(), 'email' => $email,
                'passwordHash' => $hash, 'version' => ($existing['version'] ?? 0) + 1, 'blocked' => false,
                'createdAt' => $existing['createdAt'] ?? calendar_now()];
            unset($state['links'][$key]);
            $session = $this->newAccountSession($state, $email);
            $this->writeAccounts($state);
            return $session;
        });
    }
    public function accountLogin(string $email, string $password, string $address): string {
        return calendar_with_lock($this->locksDirectory, 'accounts', function () use ($email, $password, $address): string {
            $state = $this->accountState(); $key = calendar_hash($address);
            $state['attempts'] = array_filter($state['attempts'], static fn($item) => ($item['at'] ?? 0) > time() - 900);
            $attempt = $state['attempts'][$key] ?? ['count' => 0, 'until' => 0];
            if ($attempt['until'] > time()) calendar_fail('login_wait', 429, 'Повторите через ' . ($attempt['until'] - time()) . ' сек.');
            $user = $state['users'][$email] ?? null;
            $valid = password_verify($password, $user['passwordHash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
            if (!$valid || !$user || $user['blocked']) {
                $count = min(10, $attempt['count'] + 1);
                $state['attempts'][$key] = ['count' => $count, 'at' => time(), 'until' => time() + ($count < 5 ? 0 : min(60, 2 ** ($count - 4)))];
                $this->writeAccounts($state); calendar_fail('invalid_login', 401, 'Неверный e-mail или пароль');
            }
            unset($state['attempts'][$key]);
            $session = $this->newAccountSession($state, $email); $this->writeAccounts($state); return $session;
        });
    }
    public function accountUser(string $token): ?array {
        if ($token === '' || strlen($token) > 200) return null;
        $state = $this->accountState(); $session = $state['sessions'][calendar_hash($token)] ?? null;
        $user = $state['users'][$session['email'] ?? ''] ?? null;
        if (!$session || !$user || $session['expires'] <= time() || $session['version'] !== $user['version'] || $user['blocked']) return null;
        unset($user['passwordHash'], $user['version']); return $user;
    }
    public function accountLogout(string $token): void {
        calendar_with_lock($this->locksDirectory, 'accounts', function () use ($token): void {
            $state = $this->accountState(); unset($state['sessions'][calendar_hash($token)]); $this->writeAccounts($state);
        });
    }
    public function accountUsers(): array {
        return array_map(static function($user) { unset($user['passwordHash'], $user['version']); return $user; }, array_values($this->accountState()['users']));
    }
    public function accountChangePassword(string $email, string $current, string $password): string {
        if (strlen($password) < 12 || strlen($password) > 72) calendar_fail('invalid_password', 400, 'Пароль: от 12 до 72 байт');
        return calendar_with_lock($this->locksDirectory, 'accounts', function () use ($email, $current, $password): string {
            $state = $this->accountState(); $user = $state['users'][$email] ?? null;
            if (!$user || $user['blocked'] || !password_verify($current, $user['passwordHash'])) calendar_fail('invalid_password', 401, 'Текущий пароль неверен');
            $state['users'][$email]['passwordHash'] = password_hash($password, PASSWORD_DEFAULT);
            $state['users'][$email]['version']++;
            $token = $this->newAccountSession($state, $email); $this->writeAccounts($state); return $token;
        });
    }
    public function accountSubscription(string $email, ?bool $subscribe = null): array {
        return calendar_with_lock($this->locksDirectory, 'identities', function () use ($email, $subscribe): array {
            $state = $this->identities(); $entry = $state['subscriptions'][$email] ?? [];
            if ($subscribe !== null) {
                $entry = array_merge($entry, ['status' => $subscribe ? 'subscribed' : 'unsubscribed',
                    'requestedAt' => calendar_now(), 'confirmedAt' => calendar_now(), 'consentVersion' => CALENDAR_CONSENT_VERSION,
                    'consentText' => CALENDAR_CONSENT_TEXT, 'unsubscribeToken' => $entry['unsubscribeToken'] ?? calendar_token(),
                    'unsubscribeRevision' => calendar_token()]);
                $entry['history'][] = ['action' => $subscribe ? 'account_subscribed' : 'account_unsubscribed', 'at' => calendar_now(), 'text' => CALENDAR_CONSENT_TEXT];
                $state['subscriptions'][$email] = $entry; calendar_atomic_json_write($this->identitiesFile, $state);
            }
            return ['subscribed' => ($entry['status'] ?? '') === 'subscribed', 'consentText' => CALENDAR_CONSENT_TEXT];
        });
    }
    public function accountTrash(?string $owner = null): array {
        $result = [];
        foreach (glob($this->dataDirectory . '/calendar-trash/*.json') ?: [] as $file) {
            $value = calendar_read_json_file($file, null);
            if ($value && ($owner === null || $value['owner'] === $owner)) $result[] = ['id' => basename($file), 'name' => $value['project']['name'], 'year' => $value['project']['year'], 'owner' => $value['owner']];
        }
        return $result;
    }
    public function accountRestoreTrash(string $file, ?string $owner = null): void {
        if (!preg_match('/^[0-9a-f-]{36}-[0-9]+\.json$/', $file)) calendar_fail('not_found', 404);
        calendar_with_lock($this->locksDirectory, 'private-calendars', function () use ($file, $owner): void {
            $source = $this->dataDirectory . '/calendar-trash/' . $file;
            $value = calendar_read_json_file($source, null);
            if (!$value || ($owner !== null && $value['owner'] !== $owner)) calendar_fail('not_found', 404);
            $calendars = $this->accountCalendars($value['owner']);
            if (count($calendars) >= 100 || array_sum(array_column($calendars, 'bytes')) + filesize($source) > 1024 * 1024 * 1024) calendar_fail('storage_quota', 413, 'Недостаточно места для восстановления. Освободите место в кабинете.');
            $target = $this->privateCalendarFile($value['id']);
            if (file_exists($target)) calendar_fail('already_restored', 409);
            if (!rename($source, $target)) throw new RuntimeException('restore_failed');
        });
    }
    public function accountLibrary(string $owner, ?array $body = null): array {
        if (!calendar_valid_uuid($owner)) calendar_fail('invalid_owner', 400);
        return calendar_with_lock($this->locksDirectory, 'account-library-' . $owner, function () use ($owner, $body): array {
            $file = $this->dataDirectory . '/library-' . $owner . '.json';
            $value = calendar_read_json_file($file, ['revision' => 0, 'templates' => [], 'grids' => []]);
            if ($body !== null) {
                if (($body['revision'] ?? null) !== $value['revision']) calendar_fail('library_conflict', 409, 'Шаблоны изменены на другом устройстве. Перезагрузите кабинет перед повтором.');
                if (!is_array($body['templates'] ?? null) || !is_array($body['grids'] ?? null) || count($body['templates']) > 100 || count($body['grids']) > 100) calendar_fail('invalid_library', 400);
                $value = ['revision' => $value['revision'] + 1, 'templates' => $body['templates'], 'grids' => $body['grids']];
                calendar_atomic_json_write($file, $value);
            }
            return $value;
        });
    }
    public function accountBlock(string $id, bool $blocked): void {
        calendar_with_lock($this->locksDirectory, 'accounts', function () use ($id, $blocked): void {
            $state = $this->accountState();
            $found = false;
            foreach ($state['users'] as &$user) if ($user['id'] === $id) { $user['blocked'] = $blocked; $user['version']++; $found = true; }
            if (!$found) calendar_fail('account_not_found', 404);
            unset($user); $this->writeAccounts($state);
        });
    }
    private function privateCalendarFile(string $id): string {
        if (!calendar_valid_uuid($id)) calendar_fail('calendar_not_found', 404);
        $directory = $this->dataDirectory . '/calendars';
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('storage_unavailable');
        return $directory . '/' . $id . '.json';
    }
    public function accountCalendars(?string $owner): array {
        $rows = [];
        $owners = array_column($this->accountUsers(), 'email', 'id');
        foreach (glob($this->dataDirectory . '/calendars/*.json') ?: [] as $file) {
            $value = calendar_read_json_file($file, null);
            if (!$value || ($owner !== null && $value['owner'] !== $owner)) continue;
            $rows[] = ['id' => $value['id'], 'owner' => $value['owner'], 'name' => $value['project']['name'],
                'year' => $value['project']['year'], 'updatedAt' => $value['updatedAt'], 'revision' => $value['revision'],
                'pages' => count($value['project']['document']['pages']), 'bytes' => filesize($file),
                'ownerEmail' => $owners[$value['owner']] ?? null];
        }
        usort($rows, static fn($a, $b) => strcmp($b['updatedAt'], $a['updatedAt']));
        return $rows;
    }
    public function accountCalendar(string $id, ?string $owner): array {
        $value = calendar_read_json_file($this->privateCalendarFile($id), null);
        if (!$value || ($owner !== null && $value['owner'] !== $owner)) calendar_fail('calendar_not_found', 404);
        return $value;
    }
    public function accountSaveCalendar(string $owner, ?string $id, array $project, int $revision): array {
        return calendar_with_lock($this->locksDirectory, 'private-calendars', function () use ($owner, $id, $project, $revision): array {
            $old = $id ? $this->accountCalendar($id, $owner) : null;
            if ($old && $old['revision'] !== $revision) calendar_fail('revision_conflict', 409, 'Календарь изменён в другом окне. Откройте серверную версию или скачайте свою копию.');
            if (!$old && count($this->accountCalendars($owner)) >= 100) calendar_fail('calendar_limit', 413, 'Достигнут лимит 100 календарей');
            $id ??= calendar_uuid();
            $history = $old['history'] ?? [];
            // One recovery point per minute, bounded by count and total size.
            if ($old && (!$history || calendar_timestamp(end($history)['at']) < time() - 60)) {
                $history[] = ['revision' => $old['revision'], 'at' => $old['updatedAt'], 'project' => $old['project']];
            }
            $history = array_slice($history, -10);
            while ($history && strlen(json_encode($history)) > 100 * 1024 * 1024) array_shift($history);
            $value = ['id' => $id, 'owner' => $owner, 'revision' => ($old['revision'] ?? 0) + 1,
                'updatedAt' => calendar_now(), 'project' => $project, 'history' => $history];
            $usedBytes = 0;
            foreach ($this->accountCalendars($owner) as $calendar) if ($calendar['id'] !== $id) $usedBytes += $calendar['bytes'];
            if ($usedBytes + strlen(json_encode($value)) > 1024 * 1024 * 1024) calendar_fail('storage_quota', 413, 'Лимит кабинета — 1 ГБ вместе с резервными версиями. Удалите ненужные календари.');
            calendar_atomic_json_write($this->privateCalendarFile($id), $value);
            unset($value['project'], $value['history']); return $value;
        });
    }
    public function accountDeleteCalendar(string $id, ?string $owner): void {
        calendar_with_lock($this->locksDirectory, 'private-calendars', function () use ($id, $owner): void {
            $this->accountCalendar($id, $owner);
            $trash = $this->dataDirectory . '/calendar-trash';
            if (!is_dir($trash)) mkdir($trash, 0700, true);
            if (!rename($this->privateCalendarFile($id), $trash . '/' . $id . '-' . time() . '.json')) throw new RuntimeException('delete_failed');
        });
    }
}

function calendar_account_token(): string { return is_string($_COOKIE['calendar_account'] ?? null) ? $_COOKIE['calendar_account'] : ''; }
function calendar_account_cookie(string $token): void {
    setcookie('calendar_account', $token, ['expires' => time() + ($token === '' ? -3600 : 2592000), 'path' => '/api',
        'secure' => str_starts_with(calendar_config_value('APP_PUBLIC_URL'), 'https://'), 'httponly' => true, 'samesite' => 'Strict']);
}

function calendar_account_routes(CalendarStore $store, string $method, string $path): void {
    if (!str_starts_with($path, '/v1/account')) return;
    if (!in_array($method, ['GET', 'HEAD'], true)) calendar_admin_check_origin();
    if ($method === 'POST' && $path === '/v1/account/email') {
        $body = api_request_json(4096); $email = strtolower(trim((string)($body['email'] ?? '')));
        if (!api_valid_email($email)) calendar_fail('invalid_email', 400);
        // Reuse delivery-aware throttling, including releasing failed attempts.
        if (!$store->consumeVerificationRateLimit($email, api_client_address())) {
            $retry = $store->verificationRetrySeconds($email, api_client_address());
            header('Retry-After: ' . $retry);
            calendar_fail('email_wait', 429, 'Повторная отправка будет доступна через ' . $retry . ' сек. Уже полученная ссылка продолжает работать.');
        }
        try {
            $link = $store->accountEmailLink($email, ($body['subscribe'] ?? false) === true);
            calendar_send_verification_email($email, api_public_url() . '/?account-token=' . rawurlencode($link['token']), ($body['subscribe'] ?? false) === true);
            $store->finishVerificationSend($email, api_client_address(), true);
            $store->logMail($email, 'verification', 'accepted');
        } catch (Throwable $e) { $store->finishVerificationSend($email, api_client_address(), false); $store->logMail($email, 'verification', 'failed'); throw $e; }
        api_response(200, ['ok' => true]);
    }
    if ($method === 'POST' && ($path === '/v1/account/login' || $path === '/v1/account/password')) {
        $body = api_request_json(4096);
        if (!is_string($body['password'] ?? null) || strlen($body['password']) > 72) calendar_fail('invalid_login', 400);
        $token = $path === '/v1/account/login'
            ? $store->accountLogin(strtolower(trim((string)($body['email'] ?? ''))), $body['password'], api_client_address())
            : $store->accountSetPassword((string)($body['token'] ?? ''), $body['password']);
        calendar_account_cookie($token); api_response(200, $store->accountUser($token));
    }
    if ($path === '/v1/account/session' && $method === 'GET') api_response(200, ['user' => $store->accountUser(calendar_account_token())]);
    if ($path === '/v1/account/logout' && $method === 'POST') { $store->accountLogout(calendar_account_token()); calendar_account_cookie(''); api_response(204); }
    $user = $store->accountUser(calendar_account_token());
    if (!$user) calendar_fail('login_required', 401, 'Войдите в личный кабинет');
    if ($path === '/v1/account/trash' && $method === 'GET') api_response(200, ['items' => $store->accountTrash($user['id'])]);
    if ($path === '/v1/account/trash/restore' && $method === 'POST') {
        $body = api_request_json(2048); $store->accountRestoreTrash((string)($body['id'] ?? ''), $user['id']); api_response(200, ['ok' => true]);
    }
    if ($path === '/v1/account/change-password' && $method === 'POST') {
        $body = api_request_json(4096);
        if (!is_string($body['current'] ?? null) || !is_string($body['password'] ?? null)) calendar_fail('invalid_body', 400);
        $token = $store->accountChangePassword($user['email'], $body['current'], $body['password']); calendar_account_cookie($token); api_response(200, ['ok' => true]);
    }
    if ($path === '/v1/account/subscription' && in_array($method, ['GET','PUT'], true)) {
        $body = $method === 'PUT' ? api_request_json(2048) : [];
        if ($method === 'PUT' && !is_bool($body['subscribed'] ?? null)) calendar_fail('invalid_body', 400);
        api_response(200, $store->accountSubscription($user['email'], $body['subscribed'] ?? null));
    }
    if ($path === '/v1/account/library' && in_array($method, ['GET', 'PUT'], true)) api_response(200, $store->accountLibrary($user['id'], $method === 'PUT' ? api_request_json(100 * 1024 * 1024) : null));
    if ($path === '/v1/account/calendars') {
        if ($method === 'GET') api_response(200, ['items' => $store->accountCalendars($user['id'])]);
        if ($method === 'POST') {
            $body = api_request_json(100 * 1024 * 1024);
            if (!api_valid_project($body['project'] ?? null)) calendar_fail('invalid_project', 400);
            api_response(201, $store->accountSaveCalendar($user['id'], null, $body['project'], 0));
        }
    }
    if (preg_match('#^/v1/account/calendars/([0-9a-f-]{36})(?:/history)?$#', $path, $m)) {
        $value = $store->accountCalendar($m[1], $user['id']);
        if ($method === 'GET') {
            if (str_ends_with($path, '/history')) api_response(200, ['items' => array_map(static fn($v) => ['revision' => $v['revision'], 'at' => $v['at']], $value['history'])]);
            unset($value['history']); api_response(200, $value);
        }
        if (str_ends_with($path, '/history')) api_response(405, ['error' => 'method_not_allowed']);
        if ($method === 'PUT') {
            $body = api_request_json(100 * 1024 * 1024);
            $reuse = $body['reuseAssets'] ?? [];
            if (!is_array($reuse) || count($reuse) > 10000) calendar_fail('invalid_assets', 400);
            $previousAssets = array_column($value['project']['assets'] ?? [], null, 'id');
            if ($reuse && is_array($body['project']['assets'] ?? null)) {
                foreach ($body['project']['assets'] as &$asset) {
                    if (in_array($asset['id'] ?? '', $reuse, true)) {
                        if (!isset($previousAssets[$asset['id']])) calendar_fail('invalid_assets', 400);
                        $asset['source'] = $previousAssets[$asset['id']]['source'];
                    }
                }
                unset($asset);
            }
            if (isset($body['restoreRevision'])) {
                $found = array_values(array_filter($value['history'], static fn($v) => $v['revision'] === $body['restoreRevision']));
                if (!$found) calendar_fail('backup_not_found', 404);
                $body['project'] = $found[0]['project'];
            }
            if (!api_valid_project($body['project'] ?? null) || !is_int($body['revision'] ?? null)) calendar_fail('invalid_project', 400);
            api_response(200, $store->accountSaveCalendar($user['id'], $m[1], $body['project'], $body['revision']));
        }
        if ($method === 'DELETE') { $store->accountDeleteCalendar($m[1], $user['id']); api_response(204); }
    }
    api_response(404, ['error' => 'not_found']);
}
