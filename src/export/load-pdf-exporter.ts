export class PdfExporterLoadError extends Error {
  constructor(cause: unknown) {
    super("Не удалось загрузить модуль PDF. Проверьте соединение и повторите экспорт. Если ошибка остаётся после обновления сайта, сохраните календарь или скачайте его копию через меню «Файл», затем обновите страницу (Ctrl+F5).", { cause });
    this.name = "PdfExporterLoadError";
  }
}

export async function loadPdfExporter(): Promise<typeof import("./pdf-exporter")> {
  try {
    return await import("./pdf-exporter");
  } catch (error) {
    // Never mix an old editor with a new exporter from a different build, or
    // reload automatically: unsaved changes must remain in the current tab.
    throw new PdfExporterLoadError(error);
  }
}
