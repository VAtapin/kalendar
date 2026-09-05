<?php
declare(strict_types=1);
require_once __DIR__ . '/../public/api/lib.php';
$directory = __DIR__ . '/../tmp/admin-test-' . bin2hex(random_bytes(5));
$store = new CalendarStore($directory);
function check(bool $ok, string $name): void {
    if (!$ok) throw new RuntimeException($name);
    echo "PASS: {$name}\n";
}
$email = 'reader@example.org';
$first = $store->createEmailVerification($email);
$browser = $store->confirmEmailVerification($first['token']);
check($store->subscriberPage(0)['items'][0]['status'] === 'not_subscribed', 'No implicit subscription');
for ($i = 0; $i < 8; $i++) {
    $verification = $store->createEmailVerification($email);
    $store->confirmEmailVerification($verification['token']);
}
check($store->credentialFor($browser['accessToken']) !== null, 'First browser survives subsequent confirmations');
$project = $store->createProject(['name' => 'Test calendar', 'year' => 2027, 'document' => ['pages' => [[]]], 'assets' => ['not in list']], $store->credentialFor($browser['accessToken'])['id']);
$page = $store->adminProjectPage(0);
check($page['total'] === 1 && $page['items'][0]['ownerEmail'] === $email, 'Admin project list includes owner');
check(!isset($page['items'][0]['project']) && !isset($page['items'][0]['assets']), 'Project list does not load assets into response');
check($store->readProject($project['id'])['project']['name'] === 'Test calendar', 'Read-only project fetch');
$verification = $store->createEmailVerification($email, true);
check($store->subscriberPage(0)['items'][0]['status'] === 'not_subscribed', 'Checkbox alone does not subscribe');
$store->confirmEmailVerification($verification['token']);
check($store->subscriberPage(0)['items'][0]['status'] === 'subscribed', 'One confirmation activates explicit consent');
$state = calendar_read_json_file($directory . '/email-identities.json', []);
$unsubscribe = $state['subscriptions'][$email]['unsubscribeToken'];
$stale = $store->createEmailVerification($email, true);
$store->unsubscribe($unsubscribe);
$store->confirmEmailVerification($stale['token']);
check($store->subscriberPage(0)['items'][0]['status'] === 'unsubscribed', 'Stale confirmation cannot reverse unsubscribe');
check($store->credentialFor($browser['accessToken']) !== null, 'Unsubscribe does not revoke browser access');
check($store->createCampaign('News', 'Test')['total'] === 0, 'Unsubscribed excluded from campaigns');
$verification = $store->createEmailVerification($email, true);
$store->confirmEmailVerification($verification['token']);
$campaign = $store->createCampaign('News', 'Test');
$store->unsubscribe($unsubscribe);
check($store->dispatchCampaign($campaign['id'])['skipped'] === 1, 'Unsubscribe checked again before sending');
$limitEmail = 'rate@example.org';
for ($i = 0; $i < 8; $i++) {
    check($store->consumeVerificationRateLimit($limitEmail, '127.0.0.1'), 'Failed send can retry ' . $i);
    check(!$store->consumeVerificationRateLimit($limitEmail, '127.0.0.1'), 'Parallel request blocked ' . $i);
    $store->finishVerificationSend($limitEmail, '127.0.0.1', false);
}
check($store->consumeVerificationRateLimit($limitEmail, '127.0.0.1'), 'Reserve successful attempt');
$store->finishVerificationSend($limitEmail, '127.0.0.1', true);
check(!$store->consumeVerificationRateLimit($limitEmail, '127.0.0.1'), 'Successful delivery starts cooldown');
check($store->verificationRetrySeconds($limitEmail, '127.0.0.1') <= 60, 'Cooldown is at most one minute');
$old = $store->createEmailVerification('retry@example.org');
$store->createEmailVerification('retry@example.org');
check($store->confirmEmailVerification($old['token'])['email'] === 'retry@example.org', 'Retry does not invalidate prior email');
$message = calendar_verification_html($email, 'https://example.org/?token=x', true);
check(str_contains($message, 'Подтвердить адрес и подписку'), 'Combined confirmation clearly labelled');
check(!str_contains(calendar_verification_html($email, 'https://example.org'), 'Вы отметили согласие'), 'No fabricated consent');
echo "All checks passed; isolated test data: {$directory}\n";

$paired = $store->createEmailVerification('desktop@example.org', true, true);
check($store->emailVerificationStatus($paired['requestToken'])['status'] === 'pending', 'Desktop request awaits phone confirmation');
check($store->credentialFor($paired['requestToken']) === null, 'Pending browser secret is not yet a credential');
$phone = $store->confirmEmailVerification($paired['token']);
check(!isset($phone['accessToken']) && $phone['returnToRequestingBrowser'], 'Phone receives no access token');
check($store->emailVerificationStatus($paired['requestToken'])['status'] === 'confirmed', 'Desktop can receive confirmation from another device');
check($store->credentialFor($paired['requestToken'])['email'] === 'desktop@example.org', 'Only requesting browser secret authorizes access');
check($store->emailVerificationStatus($paired['token'])['status'] === 'expired', 'Emailed token cannot claim desktop session');
check($store->emailVerificationStatus(str_repeat('x', 40))['status'] === 'expired', 'Unknown browser cannot query identity');
check(!isset($store->confirmEmailVerification($paired['token'])['accessToken']), 'Reopening phone link is idempotent without granting access');
$reopened = new CalendarStore($directory);
check($reopened->emailVerificationStatus($paired['requestToken'])['status'] === 'confirmed', 'Confirmation survives closing browser and server restart');
