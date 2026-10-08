<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/lib.php';

$store = new CalendarStore(__DIR__ . '/../tmp/editor-snapshot-storage-' . bin2hex(random_bytes(5)));
$link = $store->accountEmailLink('snapshot-test@example.org', true);
$user = $store->accountUser($store->accountSetPassword($link['token'], 'snapshot-test-password-123'));
foreach (['ru', 'de', 'cu', 'uk', 'pl'] as $language) {
    $snapshot = json_decode(gzdecode(file_get_contents(__DIR__ . '/../tests/fixtures/editor-calendar-2027-' . $language . '.json.gz')), true, 512, JSON_THROW_ON_ERROR);
    $saved = ['fetchedAt' => '2026-10-08T12:00:00.000Z', 'snapshot' => $snapshot];
    $project = ['name' => 'Snapshot ' . $language, 'year' => 2027, 'calendarLanguage' => $language,
        'calendarSnapshot' => $saved, 'document' => ['pages' => []], 'assets' => []];
    $record = $store->accountSaveCalendar($user['id'], null, $project, 0);
    $loaded = $store->accountCalendar($record['id'], $user['id']);
    if ($loaded['project']['calendarSnapshot'] !== $saved) throw new RuntimeException('Snapshot changed during server storage: ' . $language);
    $project['name'] .= ' updated';
    $store->accountSaveCalendar($user['id'], $record['id'], $project, 1);
    $loaded = $store->accountCalendar($record['id'], $user['id']);
    if ($loaded['project']['calendarSnapshot'] !== $saved || count($loaded['history']) !== 1) throw new RuntimeException('Snapshot/recovery history changed: ' . $language);
    echo 'PASS real ' . $language . " calendar snapshot survives server save/reopen/recovery history\n";
}
