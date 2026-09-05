<?php

declare(strict_types=1);

const CALENDAR_CONSENT_VERSION = '2026-09-05-v1';
const CALENDAR_CONSENT_TEXT = 'Хочу получать по электронной почте новости Календарной мастерской и напоминания о создании календарей. Отписаться можно в любой момент.';

trait CalendarAdminStore
{
    public function verificationRetrySeconds(string $email, string $address): int
    {
        $limits = calendar_read_json_file($this->rateLimitsFile, []);
        $wait = 1;
        foreach (['sent-email:' . strtolower($email) => [1, 60], 'sent-ip:' . $address => [100, 3600],
            'sending-email:' . strtolower($email) => [1, 180], 'sending-ip:' . $address => [1, 180]] as $key => [$max, $window]) {
            $entries = array_values(array_filter($limits[$key] ?? [], static fn ($stamp): bool => is_int($stamp) && $stamp > time() - $window));
            sort($entries);
            if (count($entries) >= $max) $wait = max($wait, $entries[count($entries) - $max] + $window - time());
        }
        return $wait;
    }

    public function unsubscribe(string $token): void
    {
        calendar_with_lock($this->locksDirectory, 'identities', function () use ($token): void {
            $state = $this->identities();
            foreach ($state['subscriptions'] as &$entry) {
                if ($token !== '' && hash_equals((string) ($entry['unsubscribeToken'] ?? ''), $token)) {
                    $entry['status'] = 'unsubscribed';
                    $entry['unsubscribedAt'] = calendar_now();
                    $entry['unsubscribeRevision'] = calendar_token();
                    $entry['history'][] = ['action' => 'unsubscribed', 'at' => calendar_now()];
                    calendar_atomic_json_write($this->identitiesFile, $state);
                    return;
                }
            }
            calendar_fail('unsubscribe_invalid', 400, 'Ссылка отписки недействительна');
        });
    }

    public function subscriberPage(int $offset): array
    {
        $state = $this->identities();
        $people = [];
        foreach ($state['credentials'] as $entry) {
            $people[$entry['email']] = ['email' => $entry['email'], 'status' => 'not_subscribed'];
        }
        foreach ($state['subscriptions'] as $email => $entry) {
            $people[$email] = ['email' => $email, 'status' => $entry['status'],
                'requestedAt' => $entry['requestedAt'] ?? null, 'confirmedAt' => $entry['confirmedAt'] ?? null,
                'unsubscribedAt' => $entry['unsubscribedAt'] ?? null,
                'consentVersion' => $entry['consentVersion'] ?? null, 'consentText' => $entry['consentText'] ?? null];
        }
        ksort($people);
        return ['items' => array_slice(array_values($people), $offset, 25), 'total' => count($people)];
    }

    public function adminProjectPage(int $offset): array
    {
        $files = glob($this->projectsDirectory . '/*.json') ?: [];
        sort($files);
        $owners = [];
        foreach ($this->identities()['credentials'] as $entry) $owners[$entry['id']] = $entry['email'];
        $items = [];
        // Read only one page of project bodies: assets may be large.
        foreach (array_slice($files, $offset, 25) as $file) {
            $entry = calendar_read_json_file($file, null);
            if (!is_array($entry)) continue;
            $items[] = ['id' => $entry['id'], 'name' => $entry['project']['name'] ?? 'Календарь',
                'year' => $entry['project']['year'] ?? null, 'updatedAt' => $entry['updatedAt'],
                'ownerEmail' => $entry['ownerEmail'] ?? $owners[$entry['ownerCredentialId'] ?? ''] ?? null,
                'pages' => count($entry['project']['document']['pages'] ?? []), 'bytes' => filesize($file)];
        }
        return ['items' => $items, 'total' => count($files)];
    }

    public function logMail(string $email, string $kind, string $status): void
    {
        calendar_with_lock($this->locksDirectory, 'mail-log', function () use ($email, $kind, $status): void {
            $file = $this->dataDirectory . '/mail-log.json';
            $log = calendar_read_json_file($file, []);
            $log[] = ['email' => $email, 'kind' => $kind, 'status' => $status, 'at' => calendar_now()];
            calendar_atomic_json_write($file, array_slice($log, -2000));
        });
    }

    public function mailLogPage(int $offset): array
    {
        $log = array_reverse(calendar_read_json_file($this->dataDirectory . '/mail-log.json', []));
        return ['items' => array_slice($log, $offset, 25), 'total' => count($log)];
    }

    public function createCampaign(string $subject, string $text): array
    {
        $recipients = [];
        foreach ($this->identities()['subscriptions'] as $email => $entry) {
            if (($entry['status'] ?? '') === 'subscribed') $recipients[$email] = 'pending';
        }
        $campaign = ['id' => calendar_uuid(), 'subject' => $subject, 'text' => $text,
            'createdAt' => calendar_now(), 'recipients' => $recipients];
        calendar_atomic_json_write($this->dataDirectory . '/campaign-' . $campaign['id'] . '.json', $campaign);
        return ['id' => $campaign['id'], 'total' => count($recipients)];
    }

    public function dispatchCampaign(string $id): array
    {
        if (!calendar_valid_uuid($id)) calendar_fail('invalid_campaign', 400);
        return calendar_with_lock($this->locksDirectory, 'campaign-' . $id, function () use ($id): array {
            $file = $this->dataDirectory . '/campaign-' . $id . '.json';
            $campaign = calendar_read_json_file($file, null);
            if (!is_array($campaign)) calendar_fail('campaign_not_found', 404);
            foreach ($campaign['recipients'] as $email => $status) {
                if ($status !== 'pending') continue;
                // Persist before SMTP: uncertain delivery after a crash must not be retried automatically.
                $campaign['recipients'][$email] = 'unknown';
                calendar_atomic_json_write($file, $campaign);
                $result = calendar_with_lock($this->locksDirectory, 'identities', function () use ($email, $campaign): string {
                    $entry = $this->identities()['subscriptions'][$email] ?? [];
                    if (($entry['status'] ?? '') !== 'subscribed') return 'skipped';
                    try {
                        $url = rtrim(calendar_config_value('APP_PUBLIC_URL'), '/') . '/api/v1/unsubscribe?token=' . rawurlencode($entry['unsubscribeToken']);
                        calendar_send_newsletter($email, $campaign['subject'], $campaign['text'], $url);
                        return 'accepted';
                    } catch (Throwable $error) {
                        error_log('Calendar newsletter: ' . $error->getMessage());
                        return 'failed';
                    }
                });
                $campaign['recipients'][$email] = $result;
                calendar_atomic_json_write($file, $campaign);
                $this->logMail($email, 'newsletter', $result);
                break; // One message per request, bounded SMTP time and no PHP long-running job.
            }
            $counts = array_count_values($campaign['recipients']);
            return ['id' => $id, 'total' => count($campaign['recipients']), 'pending' => $counts['pending'] ?? 0,
                'accepted' => $counts['accepted'] ?? 0, 'failed' => $counts['failed'] ?? 0,
                'unknown' => $counts['unknown'] ?? 0, 'skipped' => $counts['skipped'] ?? 0];
        });
    }
}
