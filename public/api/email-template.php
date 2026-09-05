<?php

declare(strict_types=1);

/** HTML uses tables and inline styles for email clients; no scripts or tracking. */
function calendar_verification_html(string $recipient, string $verificationUrl): string
{
    $safeUrl = htmlspecialchars($verificationUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeRecipient = htmlspecialchars($recipient, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    return <<<HTML
<!doctype html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Подтверждение e-mail — Календарная мастерская</title></head>
<body style="margin:0;padding:0;background-color:#f2efe8;color:#253a32;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;mso-hide:all;">Подтвердите адрес для работы в Календарной мастерской. Ссылка действует 30 минут.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f2efe8"><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#fffdf8;border:1px solid #ded6c4;">
<tr><td align="center" style="padding:28px 24px 22px;border-top:4px solid #b3924d;">
<a href="https://kalender.georg-kloster.ru/" style="text-decoration:none;"><img src="https://kalender.georg-kloster.ru/brand/logo-kalendar.png" width="360" alt="Календарная мастерская при Свято-Георгиевском монастыре" style="display:block;width:100%;max-width:360px;height:auto;border:0;color:#253a32;font-family:Georgia,serif;font-size:22px;"></a>
</td></tr>
<tr><td style="padding:28px 28px 30px;border-top:1px solid #e7dfcf;">
<p style="margin:0 0 12px;color:#8c6b2d;font-size:11px;font-weight:bold;letter-spacing:2px;">ВАШ КАЛЕНДАРЬ НАЧИНАЕТСЯ ЗДЕСЬ</p>
<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:normal;color:#253a32;">Подтвердите ваш e-mail</h1>
<p style="margin:0 0 14px;font-size:16px;line-height:1.65;">Здравствуйте!</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.65;">Адрес <strong style="overflow-wrap:anywhere;word-break:break-word;">{$safeRecipient}</strong> был указан для работы в Календарной мастерской. Подтвердите его, чтобы продолжить создание календаря.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#28483b" style="border-radius:4px;mso-padding-alt:16px 26px;"><a href="{$safeUrl}" style="display:inline-block;padding:16px 26px;border:1px solid #28483b;border-radius:4px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">Подтвердить e-mail&nbsp; →</a></td></tr></table>
<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6b7068;">Ссылка действует <strong>30 минут</strong>. Если вы не запрашивали подтверждение, просто удалите это письмо.</p>
<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6b7068;">Если кнопка не работает, скопируйте ссылку в браузер:<br><a href="{$safeUrl}" style="color:#476854;overflow-wrap:anywhere;word-break:break-all;">{$safeUrl}</a></p>
</td></tr>
<tr><td bgcolor="#edf0e9" style="padding:26px 28px;border-top:1px solid #dce2d6;">
<h2 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:23px;line-height:1.3;font-weight:normal;">Свято-Георгиевский<br>мужской монастырь</h2>
<p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#536055;">Православная обитель в Гётчендорфе, в Уккермарке, неподалёку от Берлина. На сайте монастыря — жизнь братии, новости и информация для паломников.</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><a href="https://georg-kloster.ru/raspisanie-bogosluzheniy/" style="color:#28483b;font-weight:bold;">Богослужения и актуальное расписание →</a></p>
<p style="margin:0;font-size:14px;line-height:1.9;"><a href="https://georg-kloster.ru/" style="color:#28483b;">Сайт монастыря</a><br><a href="https://kalender.georg-kloster.ru/" style="color:#28483b;">Календарная мастерская</a></p>
</td></tr>
<tr><td style="padding:24px 28px;border-top:1px solid #ded6c4;">
<p style="margin:0 0 10px;color:#8c6b2d;font-size:11px;font-weight:bold;letter-spacing:1.5px;">РАЗРАБОТКА И ТЕХНИЧЕСКАЯ ПОДДЕРЖКА</p>
<p style="margin:0;font-size:14px;line-height:1.9;"><a href="https://atapin.de/" style="color:#28483b;font-weight:bold;">ATAPIN.DE</a><br><a href="tel:+491713517274" style="color:#28483b;text-decoration:none;">+49 171 351 72 74</a><br><a href="mailto:atapin@gmail.com" style="color:#28483b;">atapin@gmail.com</a></p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<p style="max-width:560px;margin:18px 0 0;font-size:11px;line-height:1.6;color:#797c73;">Служебное письмо Календарной мастерской.<br>Пожалуйста, не пересылайте ссылку подтверждения другим людям.</p>
</td></tr></table>
</body></html>
HTML;
}
