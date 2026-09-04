import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createCalendarPublicApi,
  createOrthodoxCalendarApiFromXml,
  FASTING_PROFILES,
  parseCalendarApiDate,
  type FastingProfileId,
} from "../src/calendar";

const workspace = resolve(import.meta.dirname, "..");
const xml = await readFile(resolve(workspace, "public/data/MemoryDays.xml"), "utf8");
const port = Number(process.env.CALENDAR_API_PORT ?? 8787);

function respond(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": status === 200 ? "public, max-age=3600" : "no-store",
  });
  response.end(JSON.stringify(body, null, 2));
}

function profileFrom(url: URL): FastingProfileId {
  const requested = url.searchParams.get("profile") as FastingProfileId | null;
  return requested && requested in FASTING_PROFILES ? requested : "typikon-strict";
}

const apis = new Map<FastingProfileId, ReturnType<typeof createCalendarPublicApi>>();
function apiFor(profileId: FastingProfileId) {
  let api = apis.get(profileId);
  if (!api) {
    api = createCalendarPublicApi(createOrthodoxCalendarApiFromXml(
      xml,
      "MemoryDays.xml",
      { profileId },
    ));
    apis.set(profileId, api);
  }
  return api;
}

createServer((request, response) => {
  if (!request.url) return respond(response, 400, { error: "missing_url" });
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  if (request.method === "OPTIONS") return respond(response, 204, null);
  if (request.method !== "GET") return respond(response, 405, { error: "method_not_allowed" });
  const api = apiFor(profileFrom(url));
  if (url.pathname === "/health" || url.pathname === "/v1") {
    return respond(response, 200, { ok: true, ...api.metadata() });
  }
  const dayMatch = /^\/v1\/day\/(\d{4}-\d{2}-\d{2})$/.exec(url.pathname);
  if (dayMatch) {
    const date = parseCalendarApiDate(dayMatch[1]!);
    if (!date) return respond(response, 400, { error: "invalid_date" });
    return respond(response, 200, api.getDay(date));
  }
  const yearMatch = /^\/v1\/year\/(\d{4})$/.exec(url.pathname);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    if (year < 1900 || year > 2200) return respond(response, 400, { error: "invalid_year" });
    return respond(response, 200, api.getYear(year));
  }
  const paschaMatch = /^\/v1\/pascha\/(\d{4})$/.exec(url.pathname);
  if (paschaMatch) {
    const year = Number(paschaMatch[1]);
    if (year < 1900 || year > 2200) return respond(response, 400, { error: "invalid_year" });
    return respond(response, 200, api.getPascha(year));
  }
  return respond(response, 404, { error: "not_found" });
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Orthodox calendar API: http://127.0.0.1:${port}/v1\n`);
});
