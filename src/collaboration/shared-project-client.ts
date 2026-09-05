import type { CalendarGridElement, CalendarProject } from "../document/types";
import type {
  EmailVerificationConfirmed,
  EmailVerificationRequested,
  SharedProjectCreated,
  SharedProjectLease,
  SharedProjectOpenResult,
  PdfExportReady,
  PdfUploadCreated,
  UserProgramSettings,
  GlobalCalendarGridTemplatesResult,
} from "./shared-project-types";
import type { GlobalCalendarGridTemplate } from "../templates/calendar-grid-presets";

const API_BASE = (import.meta.env.VITE_CALENDAR_API_URL as string | undefined)?.replace(/\/$/, "") ?? "/api";

export class SharedProjectApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

interface ApiErrorBody {
  error?: string;
  message?: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({})) as T | ApiErrorBody;
  if (!response.ok && response.status !== 423) {
    const error = body as ApiErrorBody;
    throw new SharedProjectApiError(
      error.message ?? "Сервер совместной работы недоступен",
      response.status,
      error.error,
    );
  }
  return body as T;
}

function bearer(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export function sharedProjectIdFromLocation(location = window.location): string | undefined {
  const id = new URL(location.href).searchParams.get("shared")?.trim();
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : undefined;
}

export function sharedProjectUrl(projectId: string, location = window.location): string {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("shared", projectId);
  return url.toString();
}

export function replaceSharedProjectInLocation(projectId?: string): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("verify");
  if (projectId) url.searchParams.set("shared", projectId);
  else url.searchParams.delete("shared");
  window.history.replaceState({}, "", url);
}

export function verificationTokenFromLocation(location = window.location): string | undefined {
  return new URL(location.href).searchParams.get("verify") ?? undefined;
}

export async function requestEmailVerification(email: string): Promise<EmailVerificationRequested> {
  return request("/v1/email-verifications", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function confirmEmailVerification(token: string): Promise<EmailVerificationConfirmed> {
  return request("/v1/email-verifications/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function loadUserProgramSettings(accessToken: string): Promise<UserProgramSettings> {
  return request("/v1/user-settings", { headers: bearer(accessToken) });
}

export async function saveUserProgramSettings(
  accessToken: string,
  settings: UserProgramSettings,
): Promise<UserProgramSettings> {
  return request("/v1/user-settings", {
    method: "PUT",
    headers: bearer(accessToken),
    body: JSON.stringify(settings),
  });
}

export async function loadGlobalCalendarGridTemplates(
  accessToken?: string,
): Promise<GlobalCalendarGridTemplatesResult> {
  return request("/v1/calendar-grid-templates", {
    ...(accessToken ? { headers: bearer(accessToken) } : {}),
  });
}

export async function createGlobalCalendarGridTemplate(
  accessToken: string,
  value: { name: string; description: string; grid: CalendarGridElement },
): Promise<GlobalCalendarGridTemplate> {
  return request("/v1/calendar-grid-templates", {
    method: "POST",
    headers: bearer(accessToken),
    body: JSON.stringify(value),
  });
}

export async function updateGlobalCalendarGridTemplate(
  accessToken: string,
  templateId: string,
  value: { name: string; description: string; grid: CalendarGridElement },
): Promise<GlobalCalendarGridTemplate> {
  return request(`/v1/calendar-grid-templates/${encodeURIComponent(templateId)}`, {
    method: "PUT",
    headers: bearer(accessToken),
    body: JSON.stringify(value),
  });
}

export async function deleteGlobalCalendarGridTemplate(
  accessToken: string,
  templateId: string,
): Promise<void> {
  await request(`/v1/calendar-grid-templates/${encodeURIComponent(templateId)}`, {
    method: "DELETE",
    headers: bearer(accessToken),
  });
}

export async function createSharedProject(
  project: CalendarProject,
  accessToken: string,
  editorId: string,
  editorLabel: string,
): Promise<SharedProjectCreated> {
  return request("/v1/shared-projects", {
    method: "POST",
    headers: bearer(accessToken),
    body: JSON.stringify({ project, editorId, editorLabel }),
  });
}

export async function openSharedProject(
  projectId: string,
  editorId: string,
  editorLabel: string,
): Promise<SharedProjectOpenResult> {
  return request(`/v1/shared-projects/${projectId}/lease`, {
    method: "POST",
    body: JSON.stringify({ editorId, editorLabel }),
  });
}

export async function saveSharedProject(
  lease: SharedProjectLease,
  project: CalendarProject,
): Promise<{ revision: number; updatedAt: string }> {
  return request(`/v1/shared-projects/${lease.projectId}`, {
    method: "PUT",
    headers: { "X-Project-Lease": lease.leaseToken },
    body: JSON.stringify({ project, baseRevision: lease.revision }),
  });
}

export async function heartbeatSharedProject(
  lease: SharedProjectLease,
): Promise<{ expiresAt: string }> {
  return request(`/v1/shared-projects/${lease.projectId}/heartbeat`, {
    method: "POST",
    headers: { "X-Project-Lease": lease.leaseToken },
  });
}

export async function releaseSharedProject(lease: SharedProjectLease): Promise<void> {
  await request(`/v1/shared-projects/${lease.projectId}/lease`, {
    method: "DELETE",
    headers: { "X-Project-Lease": lease.leaseToken },
    keepalive: true,
  });
}

export async function copySharedProject(
  projectId: string,
  editorId: string,
  editorLabel: string,
): Promise<SharedProjectCreated> {
  return request(`/v1/shared-projects/${projectId}/copy`, {
    method: "POST",
    body: JSON.stringify({ editorId, editorLabel }),
  });
}

async function uploadPdfChunkWithRetry(
  upload: PdfUploadCreated,
  index: number,
  chunk: Blob,
  attempts = 3,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}/v1/pdf-exports/${upload.uploadId}/chunks/${index}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Upload-Token": upload.uploadToken,
        },
        body: chunk,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => window.setTimeout(resolve, attempt * 700));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Не удалось передать часть PDF");
}

export async function uploadPdfExport(
  pdf: Blob,
  fileName: string,
  accessToken: string,
  onProgress?: (percent: number) => void,
): Promise<PdfExportReady> {
  const upload = await request<PdfUploadCreated>("/v1/pdf-exports", {
    method: "POST",
    headers: bearer(accessToken),
    body: JSON.stringify({ fileName, size: pdf.size }),
  });
  const chunks = Math.ceil(pdf.size / upload.chunkSize);
  for (let index = 0; index < chunks; index += 1) {
    const start = index * upload.chunkSize;
    await uploadPdfChunkWithRetry(upload, index, pdf.slice(start, Math.min(pdf.size, start + upload.chunkSize)));
    onProgress?.(Math.round(((index + 1) / chunks) * 100));
  }
  return request(`/v1/pdf-exports/${upload.uploadId}/complete`, {
    method: "POST",
    headers: { "X-Upload-Token": upload.uploadToken },
  });
}
