<?php

declare(strict_types=1);

/** Find a supported Ghostscript binary without relying on PHP-FPM's PATH. */
function calendar_ghostscript_binary(): string
{
    $configured = trim(calendar_config_value('CALENDAR_GHOSTSCRIPT_BINARY'));
    $candidates = array_unique(array_filter([
        $configured,
        '/opt/ghostscript-10.08.0/bin/gs',
        '/usr/local/bin/gs',
        '/usr/local/src/ghostscript-build/ghostscript-10.08.0/bin/gs',
    ]));
    foreach ($candidates as $binary) {
        try {
            $process = @proc_open([$binary, '--version'], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        } catch (Throwable) {
            continue;
        }
        if (!is_resource($process)) {
            continue;
        }
        $version = trim(stream_get_contents($pipes[1]) ?: '');
        fclose($pipes[1]);
        fclose($pipes[2]);
        if (proc_close($process) === 0 && version_compare($version, '10.05.0', '>=')) {
            return $binary;
        }
    }
    calendar_fail('pdf_converter_unavailable', 503, 'Ghostscript 10.05+ недоступен PHP: укажите путь в CALENDAR_GHOSTSCRIPT_BINARY');
}

/** Convert an uploaded working PDF to the only format offered for print download. */
function calendar_convert_pdf_x1a(string $source, string $destination, string $profile, string $profileName): int
{
    $binary = calendar_ghostscript_binary();
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
        '-dCompatibilityLevel=1.3', '-sDEVICE=pdfwrite',
        '-sColorConversionStrategy=CMYK', '-sProcessColorModel=DeviceCMYK',
        // PDF 1.3 makes pdfwrite flatten transparency. Disabling transparency
        // earlier can make translucent overlays opaque and hide page content.
        '-dAutoRotatePages=/None',
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
