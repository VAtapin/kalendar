<?php

declare(strict_types=1);

/** Convert an uploaded working PDF to the only format offered for print download. */
function calendar_convert_pdf_x1a(string $source, string $destination, string $profile, string $profileName): int
{
    $binary = calendar_config_value('CALENDAR_GHOSTSCRIPT_BINARY', '/opt/ghostscript-10.08.0/bin/gs');
    if (!is_file($binary) || !is_executable($binary)) {
        calendar_fail('pdf_converter_unavailable', 503, 'Ghostscript 10.05 или новее не настроен на сервере');
    }
    $versionProcess = proc_open([$binary, '--version'], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $versionPipes);
    if (!is_resource($versionProcess)) {
        calendar_fail('pdf_converter_unavailable', 503, 'Не удалось запустить Ghostscript');
    }
    $version = trim(stream_get_contents($versionPipes[1]) ?: '');
    fclose($versionPipes[1]);
    fclose($versionPipes[2]);
    if (proc_close($versionProcess) !== 0 || version_compare($version, '10.05.0', '<')) {
        calendar_fail('pdf_converter_unavailable', 503, 'Для PDF/X-1a нужен Ghostscript 10.05 или новее');
    }

    $header = file_get_contents($profile, false, null, 0, 128);
    if ($header === false || strlen($header) < 128 || substr($header, 12, 4) !== 'prtr'
        || substr($header, 36, 4) !== 'acsp' || substr($header, 16, 4) !== 'CMYK') {
        calendar_fail('invalid_output_profile', 400, 'Нужен корректный CMYK ICC-профиль типографии');
    }
    $name = preg_replace('/[^A-Za-z0-9._ -]/', '', $profileName) ?: 'Custom CMYK';
    $definition = dirname($destination) . DIRECTORY_SEPARATOR . 'pdfx-definition.ps';
    // Hex strings keep paths and profile names safe in PostScript syntax.
    $postscript = "%!PS\n"
        . "[ /GTS_PDFXVersion (PDF/X-1a:2001) /Title (Calendar) /Trapped /False /DOCINFO pdfmark\n"
        . "[/_objdef {icc_PDFX} /type /stream /OBJ pdfmark\n"
        . "[{icc_PDFX} <</N 4>> /PUT pdfmark\n"
        . "[{icc_PDFX} <" . bin2hex($profile) . "> (r) file /PUT pdfmark\n"
        . "[/_objdef {OutputIntent_PDFX} /type /dict /OBJ pdfmark\n"
        . "[{OutputIntent_PDFX} <</Type /OutputIntent /S /GTS_PDFX "
        . "/OutputCondition <" . bin2hex($name) . "> /OutputConditionIdentifier (Custom) /Info <" . bin2hex($name) . "> "
        . "/RegistryName (http://www.color.org) /DestOutputProfile {icc_PDFX}>> /PUT pdfmark\n"
        . "[{Catalog} <</OutputIntents [{OutputIntent_PDFX}]>> /PUT pdfmark\n";
    if (file_put_contents($definition, $postscript, LOCK_EX) === false) {
        throw new RuntimeException('pdfx_definition_write_failed');
    }
    @chmod($definition, 0600);

    $command = [
        $binary, '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dPDFX=1',
        '-dPDFACompatibilityPolicy=2',
        '-dCompatibilityLevel=1.3', '-sDEVICE=pdfwrite',
        '-sColorConversionStrategy=CMYK', '-sProcessColorModel=DeviceCMYK',
        '-dHaveTransparency=false', '-dAutoRotatePages=/None',
        '-dDownsampleColorImages=false', '-dDownsampleGrayImages=false',
        '-dDownsampleMonoImages=false', '-r300',
        '--permit-file-read=' . $profile,
        '-sOutputICCProfile=' . $profile, '-sOutputFile=' . $destination,
        $definition, $source,
    ];
    $process = proc_open($command, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) {
        @unlink($definition);
        calendar_fail('pdf_conversion_failed', 500, 'Не удалось начать подготовку PDF/X-1a');
    }
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
        @unlink($definition);
    }
    if ($exitCode !== 0 || !is_file($destination)) {
        @unlink($destination);
        error_log('Calendar PDF/X-1a conversion failed: ' . $messages);
        calendar_fail('pdf_conversion_failed', 500, 'Не удалось подготовить PDF/X-1a:2001');
    }
    $pdfHeader = file_get_contents($destination, false, null, 0, 8);
    if ($pdfHeader !== '%PDF-1.3') {
        @unlink($destination);
        calendar_fail('pdf_conversion_failed', 500, 'Конвертер не создал PDF 1.3');
    }
    $size = filesize($destination);
    if ($size === false || $size <= 0) {
        @unlink($destination);
        calendar_fail('pdf_conversion_failed', 500, 'Конвертер создал пустой PDF');
    }
    return $size;
}
