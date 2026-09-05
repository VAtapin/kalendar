import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SharedProjectStore } from "../scripts/shared-project-store";

const temporaryDirectories: string[] = [];

async function createStore(now: () => number = Date.now): Promise<SharedProjectStore> {
  const directory = await mkdtemp(resolve(tmpdir(), "calendar-sharing-"));
  temporaryDirectories.push(directory);
  const store = new SharedProjectStore(directory, 45_000, now);
  await store.initialize();
  return store;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("shared project store", () => {
  it("confirms an e-mail with a one-time link and stores only token hashes", async () => {
    const store = await createStore();
    const pending = await store.createEmailVerification("User@Example.com");
    const confirmed = await store.confirmEmailVerification(pending.token);

    expect(confirmed.email).toBe("user@example.com");
    expect(await store.credentialFor(confirmed.accessToken)).toMatchObject({ email: "user@example.com" });
    await expect(store.confirmEmailVerification(pending.token)).rejects.toThrow("verification_invalid_or_expired");
  });

  it("bounds the number of active credentials kept for one e-mail", async () => {
    const store = await createStore();
    const accessTokens: string[] = [];
    for (let index = 0; index < 7; index += 1) {
      const pending = await store.createEmailVerification("user@example.com");
      accessTokens.push((await store.confirmEmailVerification(pending.token)).accessToken);
    }

    expect(await store.credentialFor(accessTokens[0]!)).toBeUndefined();
    expect(await store.credentialFor(accessTokens.at(-1)!)).toMatchObject({ email: "user@example.com" });
  });

  it("stores program settings per verified e-mail and shares them between its devices", async () => {
    const store = await createStore();
    const firstPending = await store.createEmailVerification("user@example.com");
    const first = await store.confirmEmailVerification(firstPending.token);
    const secondPending = await store.createEmailVerification("USER@example.com");
    const second = await store.confirmEmailVerification(secondPending.token);

    expect(await store.programSettingsFor(first.accessToken)).toEqual({ interfaceLanguage: "ru" });
    await store.saveProgramSettings(first.accessToken, { interfaceLanguage: "de" });
    expect(await store.programSettingsFor(second.accessToken)).toEqual({ interfaceLanguage: "de" });
    expect(await store.programSettingsFor("invalid-token")).toBeUndefined();
  });

  it("allows one editor, expires a lost lease and protects revisions", async () => {
    let clock = Date.parse("2026-09-04T10:00:00Z");
    const store = await createStore(() => clock);
    const stored = await store.createProject({ name: "Календарь", document: { pages: [] } }, "owner");
    const first = store.acquireLease(stored.id, "editor-one", "Редактор 1");

    expect(first).toBeDefined();
    expect(store.acquireLease(stored.id, "editor-two", "Редактор 2")).toBeUndefined();
    const updated = await store.updateProject(stored.id, first!.token, 1, { name: "Изменён", document: { pages: [] } });
    expect(updated.revision).toBe(2);
    await expect(store.updateProject(stored.id, first!.token, 1, {})).rejects.toThrow("revision_conflict");

    clock += 45_001;
    expect(store.acquireLease(stored.id, "editor-two", "Редактор 2")).toBeDefined();
  });

  it("creates an independent copy and assembles a chunked PDF", async () => {
    const store = await createStore();
    const source = await store.createProject({ name: "Исходник", document: { pages: [] } }, "owner");
    const copy = await store.copyProject(source.id);
    expect(copy.id).not.toBe(source.id);
    expect(copy.project).toEqual(source.project);

    const { upload, uploadToken } = await store.createPdfUpload("owner", "calendar.pdf", 7, 4);
    await store.writePdfChunk(upload.id, uploadToken, 0, Buffer.from("1234"));
    await store.writePdfChunk(upload.id, uploadToken, 1, Buffer.from("567"));
    const completed = await store.completePdfUpload(upload.id, uploadToken);
    expect(completed.completedAt).toBeDefined();
    expect(await readFile(store.pdfExportFile(completed), "utf8")).toBe("1234567");
  });
});
