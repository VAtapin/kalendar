<?php

declare(strict_types=1);

final class ApiFailure extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        public readonly int $httpStatus,
        string $message = '',
    ) {
        parent::__construct($message !== '' ? $message : $errorCode);
    }
}

function calendar_project_root(): string
{
    return dirname(__DIR__, 2);
}

/** @return array<string, string> */
function calendar_config(): array
{
    static $config;
    if (is_array($config)) {
        return $config;
    }

    $config = [];
    $envFile = calendar_project_root() . DIRECTORY_SEPARATOR . '.env';
    if (is_file($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || str_starts_with($line, ';')) {
                continue;
            }
            if (str_starts_with($line, 'export ')) {
                $line = trim(substr($line, 7));
            }
            $separator = strpos($line, '=');
            if ($separator === false) {
                continue;
            }
            $key = trim(substr($line, 0, $separator));
            $value = trim(substr($line, $separator + 1));
            if (!preg_match('/^[A-Z][A-Z0-9_]*$/', $key)) {
                continue;
            }
            if (strlen($value) >= 2) {
                $first = $value[0];
                $last = $value[strlen($value) - 1];
                if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                    $value = substr($value, 1, -1);
                }
            }
            $config[$key] = $value;
        }
    }

    foreach (array_keys($config + [
        'APP_PUBLIC_URL' => '',
        'CALENDAR_DATA_DIR' => '',
        'MAX_SHARED_PROJECT_BYTES' => '',
        'MAX_PDF_EXPORT_BYTES' => '',
        'CALENDAR_OWNER_EMAIL' => '',
        'SMTP_HOST' => '',
        'SMTP_PORT' => '',
        'SMTP_SECURE' => '',
        'SMTP_USER' => '',
        'SMTP_PASSWORD' => '',
        'MAIL_FROM' => '',
    ]) as $key) {
        $environmentValue = getenv($key);
        if ($environmentValue !== false) {
            $config[$key] = $environmentValue;
        }
    }

    return $config;
}

function calendar_config_value(string $key, string $default = ''): string
{
    return calendar_config()[$key] ?? $default;
}

function calendar_config_int(string $key, int $default): int
{
    $value = filter_var(calendar_config_value($key), FILTER_VALIDATE_INT);
    return is_int($value) && $value > 0 ? $value : $default;
}

function calendar_now(): string
{
    return gmdate('Y-m-d\TH:i:s.000\Z');
}

function calendar_timestamp(string $iso): int
{
    $timestamp = strtotime($iso);
    return $timestamp === false ? 0 : $timestamp;
}

function calendar_uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf('%s-%s-%s-%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4), substr($hex, 16, 4), substr($hex, 20));
}

function calendar_token(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function calendar_hash(string $value): string
{
    return hash('sha256', $value);
}

function calendar_fail(string $code, int $status, string $message = ''): never
{
    throw new ApiFailure($code, $status, $message);
}

/** @return mixed */
function calendar_read_json_file(string $path, mixed $default = null): mixed
{
    if (!is_file($path)) {
        return $default;
    }
    $contents = file_get_contents($path);
    if ($contents === false) {
        throw new RuntimeException('read_failed');
    }
    try {
        return json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new RuntimeException('invalid_stored_json');
    }
}

function calendar_atomic_json_write(string $path, mixed $value): void
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('storage_create_failed');
    }
    $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $temporary = $path . '.' . calendar_uuid() . '.tmp';
    if (file_put_contents($temporary, $json, LOCK_EX) === false) {
        throw new RuntimeException('write_failed');
    }
    @chmod($temporary, 0600);
    if (!@rename($temporary, $path)) {
        @unlink($path);
        if (!@rename($temporary, $path)) {
            @unlink($temporary);
            throw new RuntimeException('replace_failed');
        }
    }
    @chmod($path, 0600);
}

/** @template T @param callable(): T $callback @return T */
function calendar_with_lock(string $locksDirectory, string $name, callable $callback): mixed
{
    if (!is_dir($locksDirectory) && !mkdir($locksDirectory, 0700, true) && !is_dir($locksDirectory)) {
        throw new RuntimeException('storage_create_failed');
    }
    $lockPath = $locksDirectory . DIRECTORY_SEPARATOR . hash('sha256', $name) . '.lock';
    $handle = fopen($lockPath, 'c');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) {
            fclose($handle);
        }
        throw new RuntimeException('lock_failed');
    }
    try {
        return $callback();
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

final class CalendarStore
{
    private const BUILT_IN_TEMPLATE_IDS = [
        'editorial-classic',
        'monastic-book',
        'clean-modern',
        'festal-gold',
        'compact-information',
    ];

    private readonly string $projectsDirectory;
    private readonly string $leasesDirectory;
    private readonly string $pdfDirectory;
    private readonly string $locksDirectory;
    private readonly string $identitiesFile;
    private readonly string $templatesFile;
    private readonly string $rateLimitsFile;

    public function __construct(
        private readonly string $dataDirectory,
        private readonly int $leaseDurationSeconds = 45,
    ) {
        $this->projectsDirectory = $dataDirectory . DIRECTORY_SEPARATOR . 'shared-projects';
        $this->leasesDirectory = $dataDirectory . DIRECTORY_SEPARATOR . 'leases';
        $this->pdfDirectory = $dataDirectory . DIRECTORY_SEPARATOR . 'pdf-exports';
        $this->locksDirectory = $dataDirectory . DIRECTORY_SEPARATOR . '.locks';
        $this->identitiesFile = $dataDirectory . DIRECTORY_SEPARATOR . 'email-identities.json';
        $this->templatesFile = $dataDirectory . DIRECTORY_SEPARATOR . 'calendar-grid-templates.json';
        $this->rateLimitsFile = $dataDirectory . DIRECTORY_SEPARATOR . 'email-rate-limits.json';
        foreach ([$dataDirectory, $this->projectsDirectory, $this->leasesDirectory, $this->pdfDirectory, $this->locksDirectory] as $directory) {
            if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
                throw new RuntimeException('storage_create_failed');
            }
            @chmod($directory, 0700);
        }
    }

    /** @return array{pending: array<int, array<string, string>>, credentials: array<int, array<string, string>>, settingsByEmail: array<string, array<string, string>>} */
    private function identities(): array
    {
        $value = calendar_read_json_file($this->identitiesFile, []);
        return [
            'pending' => is_array($value['pending'] ?? null) ? array_values($value['pending']) : [],
            'credentials' => is_array($value['credentials'] ?? null) ? array_values($value['credentials']) : [],
            'settingsByEmail' => is_array($value['settingsByEmail'] ?? null) ? $value['settingsByEmail'] : [],
        ];
    }

    /** @return array{token: string, expiresAt: string} */
    public function createEmailVerification(string $email): array
    {
        return calendar_with_lock($this->locksDirectory, 'identities', function () use ($email): array {
            $state = $this->identities();
            $now = time();
            $normalized = strtolower(trim($email));
            $state['pending'] = array_values(array_filter(
                $state['pending'],
                static fn (array $entry): bool => calendar_timestamp((string) ($entry['expiresAt'] ?? '')) > $now
                    && ($entry['email'] ?? '') !== $normalized,
            ));
            $token = calendar_token();
            $expiresAt = gmdate('Y-m-d\TH:i:s.000\Z', $now + 1800);
            $state['pending'][] = ['tokenHash' => calendar_hash($token), 'email' => $normalized, 'expiresAt' => $expiresAt];
            calendar_atomic_json_write($this->identitiesFile, $state);
            return ['token' => $token, 'expiresAt' => $expiresAt];
        });
    }

    /** @return array{accessToken: string, email: string} */
    public function confirmEmailVerification(string $token): array
    {
        return calendar_with_lock($this->locksDirectory, 'identities', function () use ($token): array {
            $state = $this->identities();
            $now = time();
            $tokenHash = calendar_hash($token);
            $pending = null;
            $remaining = [];
            foreach ($state['pending'] as $entry) {
                if (calendar_timestamp((string) ($entry['expiresAt'] ?? '')) <= $now) {
                    continue;
                }
                if ($pending === null && hash_equals((string) ($entry['tokenHash'] ?? ''), $tokenHash)) {
                    $pending = $entry;
                    continue;
                }
                $remaining[] = $entry;
            }
            if (!is_array($pending)) {
                calendar_fail('verification_invalid_or_expired', 400, 'Ссылка подтверждения недействительна или устарела');
            }
            $email = (string) $pending['email'];
            $sameEmail = array_values(array_filter($state['credentials'], static fn (array $entry): bool => ($entry['email'] ?? '') === $email));
            $retained = array_slice($sameEmail, -4);
            $other = array_values(array_filter($state['credentials'], static fn (array $entry): bool => ($entry['email'] ?? '') !== $email));
            $accessToken = calendar_token();
            $state['pending'] = $remaining;
            $state['credentials'] = [...$other, ...$retained, [
                'id' => calendar_uuid(),
                'tokenHash' => calendar_hash($accessToken),
                'email' => $email,
                'createdAt' => calendar_now(),
            ]];
            calendar_atomic_json_write($this->identitiesFile, $state);
            return ['accessToken' => $accessToken, 'email' => $email];
        });
    }

    /** @return array{id: string, email: string}|null */
    public function credentialFor(string $accessToken): ?array
    {
        if ($accessToken === '') {
            return null;
        }
        $hash = calendar_hash($accessToken);
        foreach ($this->identities()['credentials'] as $entry) {
            if (hash_equals((string) ($entry['tokenHash'] ?? ''), $hash)) {
                return ['id' => (string) $entry['id'], 'email' => (string) $entry['email']];
            }
        }
        return null;
    }

    /** @return array{interfaceLanguage: string}|null */
    public function programSettingsFor(string $accessToken): ?array
    {
        $credential = $this->credentialFor($accessToken);
        if ($credential === null) {
            return null;
        }
        $state = $this->identities();
        $settings = $state['settingsByEmail'][$credential['email']] ?? ['interfaceLanguage' => 'ru'];
        return is_array($settings) ? $settings : ['interfaceLanguage' => 'ru'];
    }

    /** @return array{interfaceLanguage: string}|null */
    public function saveProgramSettings(string $accessToken, string $interfaceLanguage): ?array
    {
        return calendar_with_lock($this->locksDirectory, 'identities', function () use ($accessToken, $interfaceLanguage): ?array {
            $state = $this->identities();
            $hash = calendar_hash($accessToken);
            $credential = null;
            foreach ($state['credentials'] as $entry) {
                if (hash_equals((string) ($entry['tokenHash'] ?? ''), $hash)) {
                    $credential = $entry;
                    break;
                }
            }
            if (!is_array($credential)) {
                return null;
            }
            $settings = ['interfaceLanguage' => $interfaceLanguage];
            $state['settingsByEmail'][(string) $credential['email']] = $settings;
            calendar_atomic_json_write($this->identitiesFile, $state);
            return $settings;
        });
    }

    /** @return array<int, array<string, mixed>> */
    public function listGlobalTemplates(): array
    {
        $templates = calendar_read_json_file($this->templatesFile, []);
        return is_array($templates) ? array_values($templates) : [];
    }

    /** @param array{name: string, description: string, grid: array<string, mixed>} $value @return array<string, mixed> */
    public function saveGlobalTemplate(array $value, ?string $templateId = null): array
    {
        return calendar_with_lock($this->locksDirectory, 'global-templates', function () use ($value, $templateId): array {
            $templates = $this->listGlobalTemplates();
            $existingIndex = null;
            foreach ($templates as $index => $template) {
                if (($template['id'] ?? null) === $templateId) {
                    $existingIndex = $index;
                    break;
                }
            }
            $isBuiltIn = $templateId !== null && in_array($templateId, self::BUILT_IN_TEMPLATE_IDS, true);
            if ($templateId !== null && $existingIndex === null && !$isBuiltIn) {
                calendar_fail('grid_template_not_found', 404, 'Общий макет не найден');
            }
            $existing = $existingIndex !== null ? $templates[$existingIndex] : null;
            $now = calendar_now();
            $template = [
                'id' => $templateId ?? calendar_uuid(),
                'name' => trim($value['name']),
                'description' => trim($value['description']),
                'createdAt' => is_array($existing) ? (string) ($existing['createdAt'] ?? $now) : $now,
                'updatedAt' => $now,
                'builtIn' => $isBuiltIn || (bool) ($existing['builtIn'] ?? false),
                'grid' => $value['grid'],
            ];
            if ($existingIndex !== null) {
                $templates[$existingIndex] = $template;
            } else {
                $templates[] = $template;
            }
            calendar_atomic_json_write($this->templatesFile, array_values($templates));
            return $template;
        });
    }

    public function deleteGlobalTemplate(string $templateId): void
    {
        calendar_with_lock($this->locksDirectory, 'global-templates', function () use ($templateId): void {
            if (in_array($templateId, self::BUILT_IN_TEMPLATE_IDS, true)) {
                calendar_fail('built_in_grid_template', 409, 'Встроенный макет нельзя удалить');
            }
            $templates = $this->listGlobalTemplates();
            $filtered = array_values(array_filter($templates, static fn (array $template): bool => ($template['id'] ?? '') !== $templateId));
            if (count($filtered) === count($templates)) {
                calendar_fail('grid_template_not_found', 404, 'Общий макет не найден');
            }
            calendar_atomic_json_write($this->templatesFile, $filtered);
        });
    }

    /** @return array<string, mixed> */
    public function createProject(mixed $project, string $ownerCredentialId): array
    {
        $now = calendar_now();
        $stored = [
            'id' => calendar_uuid(),
            'project' => $project,
            'revision' => 1,
            'createdAt' => $now,
            'updatedAt' => $now,
            'ownerCredentialId' => $ownerCredentialId,
        ];
        calendar_atomic_json_write($this->projectFile((string) $stored['id']), $stored);
        return $stored;
    }

    /** @return array<string, mixed>|null */
    public function readProject(string $projectId): ?array
    {
        if (!calendar_valid_uuid($projectId)) {
            return null;
        }
        $value = calendar_read_json_file($this->projectFile($projectId), null);
        return is_array($value) ? $value : null;
    }

    /** @return array<string, mixed> */
    public function copyProject(string $projectId): array
    {
        $source = calendar_with_lock($this->locksDirectory, 'project-' . $projectId, fn (): ?array => $this->readProject($projectId));
        if ($source === null) {
            calendar_fail('project_not_found', 404, 'Общий календарь не найден');
        }
        return $this->createProject($source['project'], (string) ($source['ownerCredentialId'] ?? ''));
    }

    /** @return array<string, string>|null */
    public function acquireLease(string $projectId, string $editorId, string $editorLabel): ?array
    {
        return calendar_with_lock($this->locksDirectory, 'project-' . $projectId, function () use ($projectId, $editorId, $editorLabel): ?array {
            $current = $this->activeLeaseUnlocked($projectId);
            if ($current !== null && ($current['editorId'] ?? '') !== $editorId) {
                return null;
            }
            $now = time();
            $lease = [
                'projectId' => $projectId,
                'token' => calendar_token(),
                'editorId' => $editorId,
                'editorLabel' => calendar_text_slice($editorLabel, 80),
                'lastSeenAt' => gmdate('Y-m-d\TH:i:s.000\Z', $now),
                'expiresAt' => gmdate('Y-m-d\TH:i:s.000\Z', $now + $this->leaseDurationSeconds),
            ];
            calendar_atomic_json_write($this->leaseFile($projectId), $lease);
            return $lease;
        });
    }

    /** @return array<string, string>|null */
    public function activeLease(string $projectId): ?array
    {
        return calendar_with_lock($this->locksDirectory, 'project-' . $projectId, fn (): ?array => $this->activeLeaseUnlocked($projectId));
    }

    /** @return array<string, string>|null */
    private function activeLeaseUnlocked(string $projectId): ?array
    {
        $value = calendar_read_json_file($this->leaseFile($projectId), null);
        if (!is_array($value)) {
            return null;
        }
        if (calendar_timestamp((string) ($value['expiresAt'] ?? '')) <= time()) {
            @unlink($this->leaseFile($projectId));
            return null;
        }
        return $value;
    }

    /** @return array<string, string>|null */
    public function refreshLease(string $projectId, string $token): ?array
    {
        return calendar_with_lock($this->locksDirectory, 'project-' . $projectId, function () use ($projectId, $token): ?array {
            $lease = $this->activeLeaseUnlocked($projectId);
            if ($lease === null || !hash_equals((string) ($lease['token'] ?? ''), $token)) {
                return null;
            }
            $now = time();
            $lease['lastSeenAt'] = gmdate('Y-m-d\TH:i:s.000\Z', $now);
            $lease['expiresAt'] = gmdate('Y-m-d\TH:i:s.000\Z', $now + $this->leaseDurationSeconds);
            calendar_atomic_json_write($this->leaseFile($projectId), $lease);
            return $lease;
        });
    }

    public function releaseLease(string $projectId, string $token): void
    {
        calendar_with_lock($this->locksDirectory, 'project-' . $projectId, function () use ($projectId, $token): void {
            $lease = $this->activeLeaseUnlocked($projectId);
            if ($lease !== null && hash_equals((string) ($lease['token'] ?? ''), $token)) {
                @unlink($this->leaseFile($projectId));
            }
        });
    }

    /** @return array<string, mixed> */
    public function updateProject(string $projectId, string $token, int $baseRevision, mixed $project): array
    {
        return calendar_with_lock($this->locksDirectory, 'project-' . $projectId, function () use ($projectId, $token, $baseRevision, $project): array {
            $lease = $this->activeLeaseUnlocked($projectId);
            if ($lease === null || !hash_equals((string) ($lease['token'] ?? ''), $token)) {
                calendar_fail('lease_required', 403, 'Право редактирования утрачено');
            }
            $stored = $this->readProject($projectId);
            if ($stored === null) {
                calendar_fail('project_not_found', 404, 'Общий календарь не найден');
            }
            if ((int) ($stored['revision'] ?? 0) !== $baseRevision) {
                calendar_fail('revision_conflict', 409, 'Календарь уже изменён в другом окне');
            }
            $now = time();
            $lease['lastSeenAt'] = gmdate('Y-m-d\TH:i:s.000\Z', $now);
            $lease['expiresAt'] = gmdate('Y-m-d\TH:i:s.000\Z', $now + $this->leaseDurationSeconds);
            calendar_atomic_json_write($this->leaseFile($projectId), $lease);
            $stored['project'] = $project;
            $stored['revision'] = $baseRevision + 1;
            $stored['updatedAt'] = gmdate('Y-m-d\TH:i:s.000\Z', $now);
            calendar_atomic_json_write($this->projectFile($projectId), $stored);
            return $stored;
        });
    }

    /** @return array{upload: array<string, mixed>, uploadToken: string} */
    public function createPdfUpload(string $ownerCredentialId, string $requestedFileName, int $totalSize): array
    {
        $id = calendar_uuid();
        $uploadToken = calendar_token();
        $fileName = preg_replace('/[^\p{L}\p{N}._-]+/u', '-', trim($requestedFileName)) ?: 'calendar.pdf';
        $fileName = trim($fileName, '-');
        $fileName = calendar_text_slice($fileName !== '' ? $fileName : 'calendar.pdf', 160);
        if (!str_ends_with(strtolower($fileName), '.pdf')) {
            $fileName .= '.pdf';
        }
        $directory = $this->pdfUploadDirectory($id);
        $chunksDirectory = $directory . DIRECTORY_SEPARATOR . 'chunks';
        if (!mkdir($chunksDirectory, 0700, true) && !is_dir($chunksDirectory)) {
            throw new RuntimeException('storage_create_failed');
        }
        $upload = [
            'id' => $id,
            'uploadTokenHash' => calendar_hash($uploadToken),
            'ownerCredentialId' => $ownerCredentialId,
            'fileName' => $fileName,
            'totalSize' => $totalSize,
            'chunkSize' => 4 * 1024 * 1024,
            'createdAt' => calendar_now(),
        ];
        calendar_atomic_json_write($directory . DIRECTORY_SEPARATOR . 'upload.json', $upload);
        return ['upload' => $upload, 'uploadToken' => $uploadToken];
    }

    /** @return array<string, mixed>|null */
    public function readPdfUpload(string $uploadId): ?array
    {
        if (!calendar_valid_uuid($uploadId)) {
            return null;
        }
        $value = calendar_read_json_file($this->pdfUploadDirectory($uploadId) . DIRECTORY_SEPARATOR . 'upload.json', null);
        return is_array($value) ? $value : null;
    }

    public function writePdfChunk(string $uploadId, string $uploadToken, int $index, string $bytes): void
    {
        calendar_with_lock($this->locksDirectory, 'upload-' . $uploadId, function () use ($uploadId, $uploadToken, $index, $bytes): void {
            $upload = $this->readPdfUpload($uploadId);
            if ($upload === null || isset($upload['completedAt']) || !hash_equals((string) ($upload['uploadTokenHash'] ?? ''), calendar_hash($uploadToken))) {
                calendar_fail('upload_required', 403, 'Загрузка PDF не найдена');
            }
            $totalSize = (int) $upload['totalSize'];
            $chunkSize = (int) $upload['chunkSize'];
            $chunkCount = (int) ceil($totalSize / $chunkSize);
            if ($index < 0 || $index >= $chunkCount) {
                calendar_fail('invalid_chunk', 400);
            }
            $expectedSize = $index === $chunkCount - 1 ? $totalSize - $index * $chunkSize : $chunkSize;
            if (strlen($bytes) !== $expectedSize) {
                calendar_fail('invalid_chunk_size', 400);
            }
            $path = $this->pdfUploadDirectory($uploadId) . DIRECTORY_SEPARATOR . 'chunks' . DIRECTORY_SEPARATOR . $index . '.part';
            if (file_put_contents($path, $bytes, LOCK_EX) === false) {
                throw new RuntimeException('write_failed');
            }
            @chmod($path, 0600);
        });
    }

    /** @return array<string, mixed> */
    public function completePdfUpload(string $uploadId, string $uploadToken): array
    {
        return calendar_with_lock($this->locksDirectory, 'upload-' . $uploadId, function () use ($uploadId, $uploadToken): array {
            $upload = $this->readPdfUpload($uploadId);
            if ($upload === null || !hash_equals((string) ($upload['uploadTokenHash'] ?? ''), calendar_hash($uploadToken))) {
                calendar_fail('upload_required', 403, 'Загрузка PDF не найдена');
            }
            if (isset($upload['completedAt'])) {
                return $upload;
            }
            $target = $this->pdfExportFile($upload);
            $output = fopen($target, 'wb');
            if ($output === false) {
                throw new RuntimeException('write_failed');
            }
            $totalSize = (int) $upload['totalSize'];
            $chunkSize = (int) $upload['chunkSize'];
            $chunkCount = (int) ceil($totalSize / $chunkSize);
            $written = 0;
            try {
                for ($index = 0; $index < $chunkCount; $index++) {
                    $partPath = $this->pdfUploadDirectory($uploadId) . DIRECTORY_SEPARATOR . 'chunks' . DIRECTORY_SEPARATOR . $index . '.part';
                    $input = fopen($partPath, 'rb');
                    if ($input === false) {
                        calendar_fail('upload_incomplete', 400, 'Не все части PDF загружены');
                    }
                    $copied = stream_copy_to_stream($input, $output);
                    fclose($input);
                    if ($copied === false) {
                        throw new RuntimeException('write_failed');
                    }
                    $written += $copied;
                }
            } finally {
                fclose($output);
            }
            if ($written !== $totalSize) {
                @unlink($target);
                calendar_fail('upload_incomplete', 400, 'Размер собранного PDF не совпадает');
            }
            @chmod($target, 0600);
            $upload['completedAt'] = calendar_now();
            calendar_atomic_json_write($this->pdfUploadDirectory($uploadId) . DIRECTORY_SEPARATOR . 'upload.json', $upload);
            calendar_remove_directory($this->pdfUploadDirectory($uploadId) . DIRECTORY_SEPARATOR . 'chunks');
            return $upload;
        });
    }

    /** @param array<string, mixed> $upload */
    public function pdfExportFile(array $upload): string
    {
        return $this->pdfUploadDirectory((string) $upload['id']) . DIRECTORY_SEPARATOR . basename((string) $upload['fileName']);
    }

    public function consumeVerificationRateLimit(string $email, string $address): bool
    {
        return calendar_with_lock($this->locksDirectory, 'rate-limits', function () use ($email, $address): bool {
            $limits = calendar_read_json_file($this->rateLimitsFile, []);
            $limits = is_array($limits) ? $limits : [];
            $cutoff = time() - 3600;
            $keys = ['email:' . strtolower($email) => 5, 'ip:' . $address => 20];
            foreach ($limits as $key => $entries) {
                $limits[$key] = array_values(array_filter(is_array($entries) ? $entries : [], static fn (mixed $stamp): bool => is_int($stamp) && $stamp >= $cutoff));
                if ($limits[$key] === []) {
                    unset($limits[$key]);
                }
            }
            foreach ($keys as $key => $maximum) {
                if (count($limits[$key] ?? []) >= $maximum) {
                    calendar_atomic_json_write($this->rateLimitsFile, $limits);
                    return false;
                }
            }
            foreach ($keys as $key => $_maximum) {
                $limits[$key][] = time();
            }
            calendar_atomic_json_write($this->rateLimitsFile, $limits);
            return true;
        });
    }

    private function projectFile(string $projectId): string
    {
        return $this->projectsDirectory . DIRECTORY_SEPARATOR . $projectId . '.json';
    }

    private function leaseFile(string $projectId): string
    {
        return $this->leasesDirectory . DIRECTORY_SEPARATOR . $projectId . '.json';
    }

    private function pdfUploadDirectory(string $uploadId): string
    {
        return $this->pdfDirectory . DIRECTORY_SEPARATOR . $uploadId;
    }
}

function calendar_valid_uuid(string $value): bool
{
    return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value) === 1;
}

function calendar_text_slice(string $value, int $maximumCharacters): string
{
    return function_exists('mb_strcut') ? mb_strcut($value, 0, $maximumCharacters, 'UTF-8') : substr($value, 0, $maximumCharacters);
}

function calendar_remove_directory(string $directory): void
{
    if (!is_dir($directory)) {
        return;
    }
    foreach (scandir($directory) ?: [] as $name) {
        if ($name === '.' || $name === '..') {
            continue;
        }
        $path = $directory . DIRECTORY_SEPARATOR . $name;
        is_dir($path) ? calendar_remove_directory($path) : @unlink($path);
    }
    @rmdir($directory);
}

function calendar_smtp_read($socket): int
{
    $code = 0;
    while (($line = fgets($socket, 4096)) !== false) {
        if (preg_match('/^(\d{3})([ -])/', $line, $match)) {
            $code = (int) $match[1];
            if ($match[2] === ' ') {
                return $code;
            }
        }
    }
    return $code;
}

function calendar_smtp_command($socket, string $command, array $expectedCodes): void
{
    if (fwrite($socket, $command . "\r\n") === false) {
        throw new RuntimeException('smtp_write_failed');
    }
    $code = calendar_smtp_read($socket);
    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('smtp_error_' . $code);
    }
}

function calendar_send_verification_email(string $recipient, string $verificationUrl): void
{
    $host = calendar_config_value('SMTP_HOST');
    $port = calendar_config_int('SMTP_PORT', 465);
    $secure = strtolower(calendar_config_value('SMTP_SECURE', 'true')) === 'true';
    $username = calendar_config_value('SMTP_USER');
    $password = calendar_config_value('SMTP_PASSWORD');
    if ($host === '' || $username === '' || $password === '') {
        throw new RuntimeException('smtp_not_configured');
    }

    $context = stream_context_create(['ssl' => [
        'verify_peer' => true,
        'verify_peer_name' => true,
        'peer_name' => $host,
    ]]);
    $transport = $secure ? 'ssl://' : 'tcp://';
    $socket = stream_socket_client($transport . $host . ':' . $port, $errorNumber, $errorMessage, 30, STREAM_CLIENT_CONNECT, $context);
    if ($socket === false) {
        throw new RuntimeException('smtp_connect_failed_' . $errorNumber . '_' . $errorMessage);
    }
    stream_set_timeout($socket, 30);
    try {
        if (calendar_smtp_read($socket) !== 220) {
            throw new RuntimeException('smtp_greeting_failed');
        }
        calendar_smtp_command($socket, 'EHLO kalender.georg-kloster.ru', [250]);
        if (!$secure) {
            calendar_smtp_command($socket, 'STARTTLS', [220]);
            if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                throw new RuntimeException('smtp_tls_failed');
            }
            calendar_smtp_command($socket, 'EHLO kalender.georg-kloster.ru', [250]);
        }
        calendar_smtp_command($socket, 'AUTH LOGIN', [334]);
        calendar_smtp_command($socket, base64_encode($username), [334]);
        calendar_smtp_command($socket, base64_encode($password), [235]);
        calendar_smtp_command($socket, 'MAIL FROM:<' . $username . '>', [250]);
        calendar_smtp_command($socket, 'RCPT TO:<' . $recipient . '>', [250, 251]);
        calendar_smtp_command($socket, 'DATA', [354]);

        $from = calendar_config_value('MAIL_FROM', 'Календарная мастерская <' . $username . '>');
        $subject = 'Подтверждение e-mail — Календарная мастерская';
        $html = '<p>Подтвердите e-mail для работы в «Календарной мастерской».</p>'
            . '<p><a href="' . htmlspecialchars($verificationUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '">Подтвердить e-mail</a></p>'
            . '<p>Ссылка действует 30 минут.</p>';
        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'Message-ID: <' . bin2hex(random_bytes(16)) . '@kalender.georg-kloster.ru>',
            'From: ' . $from,
            'To: ' . $recipient,
            'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
            '',
            rtrim(chunk_split(base64_encode($html), 76, "\r\n")),
            '.',
        ];
        if (fwrite($socket, implode("\r\n", $headers) . "\r\n") === false || calendar_smtp_read($socket) !== 250) {
            throw new RuntimeException('smtp_message_failed');
        }
        calendar_smtp_command($socket, 'QUIT', [221]);
    } finally {
        fclose($socket);
    }
}
