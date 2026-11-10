type ErrorKind = 'network' | 'http' | 'javascript' | 'unhandled-rejection' | 'resource' | 'vue' | 'print';
type Operation = 'calendar-save' | 'account' | 'api' | 'external' | 'application' | 'print-fonts' | 'print-render' | 'print-profile' | 'print-upload';
const endpoint = '/api/v1/client-errors';
let applicationReporter: ((kind: ErrorKind, operation: Operation) => void) | undefined;

export function reportPrintError(phase: string): void {
  const operation: Operation = phase === 'load-fonts' ? 'print-fonts' : phase === 'render-pages' ? 'print-render'
    : phase === 'load-profile' ? 'print-profile' : 'print-upload';
  applicationReporter?.('print', operation);
}

/** Metadata only. Do not send messages, stacks, URLs, project data or private input. */
export function installErrorJournal(target: Window = window): (kind: ErrorKind) => void {
  const originalFetch = target.fetch.bind(target);
  let minute = -1;
  let reports = 0;
  const report = (kind: ErrorKind, operation: Operation = 'application', status = 0): void => {
    const currentMinute = Math.floor(Date.now() / 60000);
    if (minute !== currentMinute) { minute = currentMinute; reports = 0; }
    if (reports++ >= 20) return;
    // Use the original fetch so a diagnostic failure never reports itself.
    try {
      void originalFetch(endpoint, { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, operation, status }) }).catch(() => {});
    } catch { /* Reporting must not change application behavior. */ }
  };
  applicationReporter = report;
  target.fetch = async (input, init) => {
    let operation: Operation = 'external';
    let diagnostic = false;
    try {
      const request = typeof input === 'string' || input instanceof URL ? input : input.url;
      const url = new URL(request, target.location.href);
      diagnostic = url.origin === target.location.origin && url.pathname === endpoint;
      if (url.origin === target.location.origin) {
        const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
        operation = /^\/api\/v1\/account\/calendars(?:\/[^/]+)?$/.test(url.pathname) && ['POST', 'PUT'].includes(method)
          ? 'calendar-save' : url.pathname.startsWith('/api/v1/account/') ? 'account' : 'api';
      }
    } catch { /* Let fetch validate its own input. */ }
    try {
      const response = await originalFetch(input, init);
      if (!response.ok && !diagnostic) report('http', operation, response.status);
      return response;
    } catch (error) {
      if (!diagnostic && !(error instanceof Error && error.name === 'AbortError') && !init?.signal?.aborted) report('network', operation);
      throw error;
    }
  };
  target.addEventListener('error', event => report(event.target && event.target !== target ? 'resource' : 'javascript'), true);
  target.addEventListener('unhandledrejection', event => {
    if (!(event.reason instanceof Error && event.reason.name === 'AbortError')) report('unhandled-rejection');
  });
  return kind => report(kind);
}
