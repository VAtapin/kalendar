import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import nodemailer from "nodemailer";
import {
  createCalendarPublicApi,
  createOrthodoxCalendarApiFromXml,
  FASTING_PROFILES,
  parseCalendarApiDate,
  type FastingProfileId,
} from "../src/calendar";
import { SharedProjectStore } from "./shared-project-store";
import { parseHttpByteRange } from "./http-byte-range";
import type { CalendarGridElement } from "../src/document/types";

const workspace = resolve(import.meta.dirname, "..");
const xml = await readFile(resolve(workspace, "public/data/MemoryDays.xml"), "utf8");
const port = Number(process.env.CALENDAR_API_PORT ?? 8787);
const host = process.env.CALENDAR_API_HOST ?? "127.0.0.1";
const publicAppUrl = (process.env.APP_PUBLIC_URL ?? "http://127.0.0.1:5173").replace(/\/$/, "");
const dataDirectory = resolve(process.env.CALENDAR_DATA_DIR ?? resolve(workspace, ".data"));
const allowedOrigin = process.env.CALENDAR_ALLOWED_ORIGIN ?? "*";
const maxProjectBytes = Number(process.env.MAX_SHARED_PROJECT_BYTES ?? 100 * 1024 * 1024);
const maxPdfBytes = Number(process.env.MAX_PDF_EXPORT_BYTES ?? 300 * 1024 * 1024);
const calendarOwnerEmail = (process.env.CALENDAR_OWNER_EMAIL ?? "").trim().toLowerCase();
const store = new SharedProjectStore(dataDirectory);
await store.initialize();

const verificationRequests = new Map<string, number[]>();

function corsHeaders(request: IncomingMessage): Record<string, string> {
  const origin = request.headers.origin;
  const selected = allowedOrigin === "*" ? "*" : origin === allowedOrigin ? origin : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": selected,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Project-Lease, X-Upload-Token",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, DELETE, OPTIONS",
    Vary: "Origin",
  };
}

function respond(request: IncomingMessage, response: ServerResponse, status: number, body: unknown, cache = false): void {
  response.writeHead(status, {
    ...corsHeaders(request),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cache && status === 200 ? "public, max-age=3600" : "no-store",
  });
  response.end(status === 204 ? undefined : JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximumBytes: number): Promise<Buffer> {
  const declaredLength = Number(request.headers["content-length"]);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error("payload_too_large");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const part of request) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    size += chunk.length;
    if (size > maximumBytes) throw new Error("payload_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson<T>(request: IncomingMessage, maximumBytes = 1024 * 1024): Promise<T> {
  try {
    return JSON.parse((await readBody(request, maximumBytes)).toString("utf8")) as T;
  } catch (error) {
    if (error instanceof Error && error.message === "payload_too_large") throw error;
    throw new Error("invalid_json");
  }
}

function bearerToken(request: IncomingMessage): string | undefined {
  return /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? "")?.[1];
}

function leaseToken(request: IncomingMessage): string {
  return typeof request.headers["x-project-lease"] === "string" ? request.headers["x-project-lease"] : "";
}

function uploadToken(request: IncomingMessage): string {
  return typeof request.headers["x-upload-token"] === "string" ? request.headers["x-upload-token"] : "";
}

function profileFrom(url: URL): FastingProfileId {
  const requested = url.searchParams.get("profile") as FastingProfileId | null;
  return requested && requested in FASTING_PROFILES ? requested : "typikon-strict";
}

const apis = new Map<FastingProfileId, ReturnType<typeof createCalendarPublicApi>>();
function apiFor(profileId: FastingProfileId) {
  let api = apis.get(profileId);
  if (!api) {
    api = createCalendarPublicApi(createOrthodoxCalendarApiFromXml(xml, "MemoryDays.xml", { profileId }));
    apis.set(profileId, api);
  }
  return api;
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clientAddress(request: IncomingMessage): string {
  const socketAddress = request.socket.remoteAddress ?? "unknown";
  const fromLoopback = socketAddress === "127.0.0.1" || socketAddress === "::1" || socketAddress === "::ffff:127.0.0.1";
  const forwarded = request.headers["x-forwarded-for"];
  if (!fromLoopback || typeof forwarded !== "string") return socketAddress;
  return forwarded.split(",", 1)[0]!.trim().slice(0, 80) || socketAddress;
}

function consumeVerificationRateLimit(key: string, maximum: number, cutoff: number): boolean {
  const recent = (verificationRequests.get(key) ?? []).filter((time) => time >= cutoff);
  if (recent.length >= maximum) {
    verificationRequests.set(key, recent);
    return false;
  }
  recent.push(Date.now());
  verificationRequests.set(key, recent);
  return true;
}

function verificationRateAllowed(request: IncomingMessage, email: string): boolean {
  const cutoff = Date.now() - 60 * 60_000;
  for (const [key, entries] of verificationRequests) {
    if (!entries.some((time) => time >= cutoff)) verificationRequests.delete(key);
  }
  const emailAllowed = consumeVerificationRateLimit(`email:${email.toLowerCase()}`, 5, cutoff);
  const addressAllowed = consumeVerificationRateLimit(`ip:${clientAddress(request)}`, 20, cutoff);
  return emailAllowed && addressAllowed;
}

async function sendVerificationEmail(email: string, verificationUrl: string): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) {
    if (process.env.NODE_ENV === "production") throw new Error("smtp_not_configured");
    process.stdout.write(`Verification link for ${email}: ${verificationUrl}\n`);
    return false;
  }
  const smtpPort = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" } : undefined,
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? "Календарная мастерская <noreply@georg-kloster.ru>",
    to: email,
    subject: "Подтверждение e-mail — Календарная мастерская",
    text: `Подтвердите e-mail, открыв ссылку: ${verificationUrl}\n\nСсылка действует 30 минут.`,
    html: `<p>Подтвердите e-mail для работы в «Календарной мастерской».</p><p><a href="${verificationUrl}">Подтвердить e-mail</a></p><p>Ссылка действует 30 минут.</p>`,
  });
  return true;
}

function validProject(value: unknown): value is { document: { pages: unknown[] } } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { schemaVersion?: unknown; name?: unknown; document?: unknown };
  const pages = candidate.document && typeof candidate.document === "object"
    ? (candidate.document as { pages?: unknown }).pages
    : undefined;
  return candidate.schemaVersion === 1 &&
    typeof candidate.name === "string" && candidate.name.length <= 200 &&
    Array.isArray(pages) && pages.length > 0 && pages.length <= 100;
}

function validGlobalGridTemplate(value: unknown): value is {
  name: string;
  description: string;
  grid: CalendarGridElement;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { name?: unknown; description?: unknown; grid?: unknown };
  if (typeof candidate.name !== "string" || !candidate.name.trim() || candidate.name.length > 80) return false;
  if (typeof candidate.description !== "string" || candidate.description.length > 300) return false;
  if (!candidate.grid || typeof candidate.grid !== "object") return false;
  const grid = candidate.grid as Partial<CalendarGridElement>;
  return grid.type === "calendar-grid" &&
    grid.columns === 7 &&
    (grid.weekRows === 4 || grid.weekRows === 5 || grid.weekRows === 6) &&
    typeof grid.weekdayLabelMode === "string" &&
    typeof grid.showWeekdayHeader === "boolean" &&
    typeof grid.dayNumberFontFamily === "string" && grid.dayNumberFontFamily.length <= 120 &&
    typeof grid.eventFontFamily === "string" && grid.eventFontFamily.length <= 120;
}

async function calendarOwnerFor(request: IncomingMessage): Promise<{ id: string; email: string } | undefined> {
  if (!calendarOwnerEmail) return undefined;
  const token = bearerToken(request);
  const credential = token ? await store.credentialFor(token) : undefined;
  return credential?.email === calendarOwnerEmail ? credential : undefined;
}

function editorBody(value: unknown): { editorId: string; editorLabel: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const body = value as { editorId?: unknown; editorLabel?: unknown };
  if (typeof body.editorId !== "string" || body.editorId.length < 8 || body.editorId.length > 100) return undefined;
  return {
    editorId: body.editorId,
    editorLabel: typeof body.editorLabel === "string" && body.editorLabel.trim()
      ? body.editorLabel.trim().slice(0, 80)
      : "Другой редактор",
  };
}

function leaseResponse(stored: { id: string; project: unknown; revision: number }, lease: NonNullable<ReturnType<SharedProjectStore["acquireLease"]>>) {
  return {
    status: "editing",
    projectId: stored.id,
    project: stored.project,
    revision: stored.revision,
    leaseToken: lease.token,
    expiresAt: lease.expiresAt,
  };
}

function appUrlFor(request: IncomingMessage): string {
  const origin = request.headers.origin;
  return process.env.NODE_ENV !== "production" && origin && /^https?:\/\//i.test(origin)
    ? origin.replace(/\/$/, "")
    : publicAppUrl;
}

function shareUrl(request: IncomingMessage, projectId: string): string {
  const url = new URL(appUrlFor(request));
  url.searchParams.set("shared", projectId);
  return url.toString();
}

function downloadUrl(request: IncomingMessage, uploadId: string, fileName: string): string {
  return `${appUrlFor(request)}/api/v1/pdf-exports/${uploadId}/download/${encodeURIComponent(fileName)}`;
}

async function servePdfDownload(request: IncomingMessage, response: ServerResponse, uploadId: string): Promise<void> {
  const upload = await store.readPdfUpload(uploadId);
  if (!upload?.completedAt) return respond(request, response, 404, { error: "export_not_found", message: "PDF не найден" });
  const file = store.pdfExportFile(upload);
  const fileStat = await stat(file);
  const range = parseHttpByteRange(request.headers.range, fileStat.size);
  if (range === null) {
    response.writeHead(416, { ...corsHeaders(request), "Content-Range": `bytes */${fileStat.size}` });
    response.end();
    return;
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? fileStat.size - 1;
  const status = range ? 206 : 200;
  response.writeHead(status, {
    ...corsHeaders(request),
    "Content-Type": "application/pdf",
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(upload.fileName)}`,
    ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${fileStat.size}` } : {}),
    "Cache-Control": "private, max-age=86400",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  try {
    await pipeline(createReadStream(file, { start, end }), response);
  } catch (error) {
    if (request.destroyed || response.destroyed) return;
    throw error;
  }
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!request.url) return respond(request, response, 400, { error: "missing_url" });
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  if (request.method === "OPTIONS") return respond(request, response, 204, null);

  if (request.method === "GET" || request.method === "HEAD") {
    const downloadMatch = /^\/v1\/pdf-exports\/([0-9a-f-]{36})\/download\//i.exec(url.pathname);
    if (downloadMatch) return servePdfDownload(request, response, downloadMatch[1]!);
  }

  if (request.method === "GET") {
    if (url.pathname === "/v1/calendar-grid-templates") {
      const canManage = Boolean(await calendarOwnerFor(request));
      return respond(request, response, 200, {
        templates: await store.listGlobalCalendarGridTemplates(),
        canManage: canManage,
      });
    }
    if (url.pathname === "/v1/user-settings") {
      const accessToken = bearerToken(request);
      const settings = accessToken ? await store.programSettingsFor(accessToken) : undefined;
      return settings
        ? respond(request, response, 200, settings)
        : respond(request, response, 401, { error: "email_required", message: "Сначала подтвердите e-mail" });
    }
    const api = apiFor(profileFrom(url));
    if (url.pathname === "/health" || url.pathname === "/v1") {
      return respond(request, response, 200, { ok: true, collaboration: true, ...api.metadata() }, true);
    }
    const dayMatch = /^\/v1\/day\/(\d{4}-\d{2}-\d{2})$/.exec(url.pathname);
    if (dayMatch) {
      const date = parseCalendarApiDate(dayMatch[1]!);
      return date ? respond(request, response, 200, api.getDay(date), true) : respond(request, response, 400, { error: "invalid_date" });
    }
    const yearMatch = /^\/v1\/year\/(\d{4})$/.exec(url.pathname);
    if (yearMatch) {
      const year = Number(yearMatch[1]);
      return year >= 1900 && year <= 2200 ? respond(request, response, 200, api.getYear(year), true) : respond(request, response, 400, { error: "invalid_year" });
    }
    const paschaMatch = /^\/v1\/pascha\/(\d{4})$/.exec(url.pathname);
    if (paschaMatch) {
      const year = Number(paschaMatch[1]);
      return year >= 1900 && year <= 2200 ? respond(request, response, 200, api.getPascha(year), true) : respond(request, response, 400, { error: "invalid_year" });
    }
  }

  if (request.method === "POST" && url.pathname === "/v1/email-verifications") {
    const body = await readJson<{ email?: unknown }>(request);
    if (!validEmail(body.email)) return respond(request, response, 400, { error: "invalid_email", message: "Введите действующий e-mail" });
    if (!verificationRateAllowed(request, body.email)) return respond(request, response, 429, { error: "rate_limited", message: "Слишком много писем. Повторите позднее." });
    const verification = await store.createEmailVerification(body.email);
    const link = new URL(appUrlFor(request));
    link.searchParams.set("verify", verification.token);
    const delivered = await sendVerificationEmail(body.email, link.toString());
    return respond(request, response, 201, {
      sent: true,
      expiresAt: verification.expiresAt,
      ...(!delivered && process.env.NODE_ENV !== "production" ? { developmentVerificationUrl: link.toString() } : {}),
    });
  }

  if (request.method === "POST" && url.pathname === "/v1/email-verifications/confirm") {
    const body = await readJson<{ token?: unknown }>(request);
    if (typeof body.token !== "string") return respond(request, response, 400, { error: "invalid_token" });
    return respond(request, response, 200, await store.confirmEmailVerification(body.token));
  }

  if (request.method === "PUT" && url.pathname === "/v1/user-settings") {
    const accessToken = bearerToken(request);
    const body = await readJson<{ interfaceLanguage?: unknown }>(request, 16 * 1024);
    const interfaceLanguage = body.interfaceLanguage;
    if (interfaceLanguage !== "ru" && interfaceLanguage !== "de" && interfaceLanguage !== "en" && interfaceLanguage !== "uk") {
      return respond(request, response, 400, { error: "invalid_settings", message: "Неизвестный язык интерфейса" });
    }
    const settings = accessToken
      ? await store.saveProgramSettings(accessToken, { interfaceLanguage })
      : undefined;
    return settings
      ? respond(request, response, 200, settings)
      : respond(request, response, 401, { error: "email_required", message: "Сначала подтвердите e-mail" });
  }

  if (request.method === "POST" && url.pathname === "/v1/calendar-grid-templates") {
    if (!await calendarOwnerFor(request)) {
      return respond(request, response, 403, { error: "owner_required", message: "Управление общими макетами доступно только владельцу мастерской" });
    }
    const body = await readJson(request, 256 * 1024);
    if (!validGlobalGridTemplate(body)) {
      return respond(request, response, 400, { error: "invalid_grid_template", message: "Макет календарной сетки повреждён" });
    }
    return respond(request, response, 201, await store.saveGlobalCalendarGridTemplate({
      name: body.name.trim(),
      description: body.description.trim(),
      grid: body.grid,
    }));
  }

  const globalGridTemplateMatch = /^\/v1\/calendar-grid-templates\/([0-9a-z-]{1,80})$/i.exec(url.pathname);
  if (globalGridTemplateMatch && request.method === "PUT") {
    if (!await calendarOwnerFor(request)) {
      return respond(request, response, 403, { error: "owner_required", message: "Управление общими макетами доступно только владельцу мастерской" });
    }
    const body = await readJson(request, 256 * 1024);
    if (!validGlobalGridTemplate(body)) {
      return respond(request, response, 400, { error: "invalid_grid_template", message: "Макет календарной сетки повреждён" });
    }
    return respond(request, response, 200, await store.saveGlobalCalendarGridTemplate({
      name: body.name.trim(),
      description: body.description.trim(),
      grid: body.grid,
    }, globalGridTemplateMatch[1]!));
  }

  if (globalGridTemplateMatch && request.method === "DELETE") {
    if (!await calendarOwnerFor(request)) {
      return respond(request, response, 403, { error: "owner_required", message: "Управление общими макетами доступно только владельцу мастерской" });
    }
    await store.deleteGlobalCalendarGridTemplate(globalGridTemplateMatch[1]!);
    return respond(request, response, 204, null);
  }

  if (request.method === "POST" && url.pathname === "/v1/shared-projects") {
    const accessToken = bearerToken(request);
    const credential = accessToken ? await store.credentialFor(accessToken) : undefined;
    if (!credential) return respond(request, response, 401, { error: "email_required", message: "Сначала подтвердите e-mail" });
    const body = await readJson<{ project?: unknown; editorId?: unknown; editorLabel?: unknown }>(request, maxProjectBytes);
    const editor = editorBody(body);
    if (!validProject(body.project) || !editor) return respond(request, response, 400, { error: "invalid_project", message: "Проект повреждён" });
    const stored = await store.createProject(body.project, credential.id);
    const lease = store.acquireLease(stored.id, editor.editorId, editor.editorLabel)!;
    return respond(request, response, 201, { ...leaseResponse(stored, lease), shareUrl: shareUrl(request, stored.id) });
  }

  const leaseMatch = /^\/v1\/shared-projects\/([0-9a-f-]{36})\/lease$/i.exec(url.pathname);
  if (leaseMatch && request.method === "POST") {
    const stored = await store.readProject(leaseMatch[1]!);
    if (!stored) return respond(request, response, 404, { error: "project_not_found", message: "Общий календарь не найден" });
    const editor = editorBody(await readJson(request));
    if (!editor) return respond(request, response, 400, { error: "invalid_editor" });
    const lease = store.acquireLease(stored.id, editor.editorId, editor.editorLabel);
    if (!lease) {
      const current = store.activeLease(stored.id)!;
      return respond(request, response, 423, {
        status: "locked",
        projectId: stored.id,
        project: stored.project,
        revision: stored.revision,
        editor: { label: current.editorLabel, lastSeenAt: current.lastSeenAt, expiresAt: current.expiresAt },
      });
    }
    return respond(request, response, 200, leaseResponse(stored, lease));
  }

  if (leaseMatch && request.method === "DELETE") {
    store.releaseLease(leaseMatch[1]!, leaseToken(request));
    return respond(request, response, 204, null);
  }

  const heartbeatMatch = /^\/v1\/shared-projects\/([0-9a-f-]{36})\/heartbeat$/i.exec(url.pathname);
  if (heartbeatMatch && request.method === "POST") {
    const lease = store.refreshLease(heartbeatMatch[1]!, leaseToken(request));
    return lease ? respond(request, response, 200, { expiresAt: lease.expiresAt }) : respond(request, response, 409, { error: "lease_lost", message: "Право редактирования утрачено" });
  }

  const copyMatch = /^\/v1\/shared-projects\/([0-9a-f-]{36})\/copy$/i.exec(url.pathname);
  if (copyMatch && request.method === "POST") {
    const editor = editorBody(await readJson(request));
    if (!editor) return respond(request, response, 400, { error: "invalid_editor" });
    const stored = await store.copyProject(copyMatch[1]!);
    const lease = store.acquireLease(stored.id, editor.editorId, editor.editorLabel)!;
    return respond(request, response, 201, { ...leaseResponse(stored, lease), shareUrl: shareUrl(request, stored.id) });
  }

  const updateMatch = /^\/v1\/shared-projects\/([0-9a-f-]{36})$/i.exec(url.pathname);
  if (updateMatch && request.method === "PUT") {
    const body = await readJson<{ project?: unknown; baseRevision?: unknown }>(request, maxProjectBytes);
    if (!validProject(body.project) || !Number.isInteger(body.baseRevision)) return respond(request, response, 400, { error: "invalid_project" });
    const updated = await store.updateProject(updateMatch[1]!, leaseToken(request), body.baseRevision as number, body.project);
    return respond(request, response, 200, { revision: updated.revision, updatedAt: updated.updatedAt });
  }

  if (request.method === "POST" && url.pathname === "/v1/pdf-exports") {
    const accessToken = bearerToken(request);
    const credential = accessToken ? await store.credentialFor(accessToken) : undefined;
    if (!credential) return respond(request, response, 401, { error: "email_required", message: "Сначала подтвердите e-mail" });
    const body = await readJson<{ fileName?: unknown; size?: unknown }>(request);
    const size = Number(body.size);
    if (typeof body.fileName !== "string" || !Number.isSafeInteger(size) || size <= 0 || size > maxPdfBytes) {
      return respond(request, response, 400, { error: "invalid_export", message: `PDF должен быть меньше ${Math.round(maxPdfBytes / 1024 / 1024)} МБ` });
    }
    const { upload, uploadToken: token } = await store.createPdfUpload(credential.id, body.fileName, size);
    return respond(request, response, 201, { uploadId: upload.id, uploadToken: token, chunkSize: upload.chunkSize });
  }

  const chunkMatch = /^\/v1\/pdf-exports\/([0-9a-f-]{36})\/chunks\/(\d+)$/i.exec(url.pathname);
  if (chunkMatch && request.method === "PUT") {
    await store.writePdfChunk(chunkMatch[1]!, uploadToken(request), Number(chunkMatch[2]), await readBody(request, 5 * 1024 * 1024));
    return respond(request, response, 204, null);
  }

  const completeMatch = /^\/v1\/pdf-exports\/([0-9a-f-]{36})\/complete$/i.exec(url.pathname);
  if (completeMatch && request.method === "POST") {
    const upload = await store.completePdfUpload(completeMatch[1]!, uploadToken(request));
    return respond(request, response, 200, { downloadUrl: downloadUrl(request, upload.id, upload.fileName), fileName: upload.fileName, size: upload.totalSize });
  }

  return respond(request, response, 404, { error: "not_found" });
}

createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    const code = error instanceof Error ? error.message : "server_error";
    const status = code === "payload_too_large" ? 413
      : code === "project_not_found" || code === "grid_template_not_found" ? 404
        : code === "revision_conflict" ? 409
          : code === "built_in_grid_template" ? 409
            : code === "lease_required" || code === "upload_required" || code === "owner_required" ? 403
            : code.startsWith("invalid_") || code === "upload_incomplete" ? 400
              : 500;
    if (status === 500) console.error(error);
    if (!response.headersSent) respond(request, response, status, { error: code, message: status === 500 ? "Внутренняя ошибка сервера" : code });
    else response.destroy();
  });
}).listen(port, host, () => {
  process.stdout.write(`Calendar API and collaboration: http://${host}:${port}/v1\n`);
  process.stdout.write(`Data directory: ${dataDirectory}\n`);
});
