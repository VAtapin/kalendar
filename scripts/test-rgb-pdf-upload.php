<?php
declare(strict_types=1);

require_once __DIR__ . '/../public/api/lib.php';

$directory = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'kalendar-rgb-pdf-' . bin2hex(random_bytes(6));
try {
    $store = new CalendarStore($directory);
    $pdf = "%PDF-1.7\nRGB fixture\n%%EOF";
    $rgb = $store->createPdfUpload('test-user', 'calendar-rgb.pdf', strlen($pdf), 'RGB', 'rgb-pdf');
    $store->writePdfChunk($rgb['upload']['id'], $rgb['uploadToken'], 0, $pdf);
    $completed = $store->completePdfUpload($rgb['upload']['id'], $rgb['uploadToken']);
    if (file_get_contents($store->pdfExportFile($completed)) !== $pdf || $completed['totalSize'] !== strlen($pdf)) {
        throw new RuntimeException('RGB PDF was changed during upload');
    }

    $print = $store->createPdfUpload('test-user', 'calendar-print.pdf', strlen($pdf));
    $store->writePdfChunk($print['upload']['id'], $print['uploadToken'], 0, $pdf);
    try {
        $store->completePdfUpload($print['upload']['id'], $print['uploadToken']);
        throw new RuntimeException('Print PDF unexpectedly accepted without a CMYK profile');
    } catch (ApiFailure $error) {
        if ($error->errorCode !== 'missing_output_profile') {
            throw $error;
        }
    }
    echo "RGB PDF upload passed; print PDF still requires a CMYK profile.\n";
} finally {
    $root = realpath(sys_get_temp_dir()) . DIRECTORY_SEPARATOR . 'kalendar-rgb-pdf-';
    $target = realpath($directory);
    if ($target !== false && str_starts_with($target, $root)) {
        calendar_remove_directory($target);
    }
}
