import { createHash, randomBytes, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface StoredSharedProject {
  id: string;
  project: unknown;
  revision: number;
  createdAt: string;
  updatedAt: string;
  ownerCredentialId: string;
}

export interface ProjectLease {
  projectId: string;
  token: string;
  editorId: string;
  editorLabel: string;
  lastSeenAt: string;
  expiresAt: string;
}

interface PersistedIdentityState {
  pending: Array<{ tokenHash: string; email: string; expiresAt: string }>;
  credentials: Array<{ id: string; tokenHash: string; email: string; createdAt: string }>;
  settingsByEmail: Record<string, { interfaceLanguage: "ru" | "de" | "en" | "uk" }>;
}

export interface PdfUploadRecord {
  id: string;
  uploadTokenHash: string;
  ownerCredentialId: string;
  fileName: string;
  totalSize: number;
  chunkSize: number;
  createdAt: string;
  completedAt?: string;
}

export class SharedProjectStore {
  private readonly leases = new Map<string, ProjectLease>();
  private identityState: PersistedIdentityState = { pending: [], credentials: [], settingsByEmail: {} };
  private initialized = false;

  constructor(
    private readonly dataDirectory: string,
    private readonly leaseDurationMs = 45_000,
    private readonly now: () => number = Date.now,
  ) {}

  private get projectsDirectory(): string {
    return resolve(this.dataDirectory, "shared-projects");
  }

  private get identitiesFile(): string {
    return resolve(this.dataDirectory, "email-identities.json");
  }

  private get pdfDirectory(): string {
    return resolve(this.dataDirectory, "pdf-exports");
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.all([
      mkdir(this.projectsDirectory, { recursive: true }),
      mkdir(this.pdfDirectory, { recursive: true }),
    ]);
    try {
      const parsed = JSON.parse(await readFile(this.identitiesFile, "utf8")) as Partial<PersistedIdentityState>;
      this.identityState = {
        pending: Array.isArray(parsed.pending) ? parsed.pending : [],
        credentials: Array.isArray(parsed.credentials) ? parsed.credentials : [],
        settingsByEmail: parsed.settingsByEmail && typeof parsed.settingsByEmail === "object"
          ? parsed.settingsByEmail
          : {},
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    this.prunePendingVerifications();
    this.initialized = true;
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private async atomicWrite(file: string, value: unknown): Promise<void> {
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, file);
  }

  private async persistIdentities(): Promise<void> {
    await this.atomicWrite(this.identitiesFile, this.identityState);
  }

  private prunePendingVerifications(): void {
    const now = this.now();
    this.identityState.pending = this.identityState.pending.filter(
      (entry) => Date.parse(entry.expiresAt) > now,
    );
  }

  async createEmailVerification(email: string, lifetimeMs = 30 * 60_000): Promise<{ token: string; expiresAt: string }> {
    await this.initialize();
    this.prunePendingVerifications();
    const normalizedEmail = email.trim().toLowerCase();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(this.now() + lifetimeMs).toISOString();
    this.identityState.pending = this.identityState.pending.filter((entry) => entry.email !== normalizedEmail);
    this.identityState.pending.push({ tokenHash: this.hash(token), email: normalizedEmail, expiresAt });
    await this.persistIdentities();
    return { token, expiresAt };
  }

  async confirmEmailVerification(token: string): Promise<{ accessToken: string; email: string }> {
    await this.initialize();
    this.prunePendingVerifications();
    const tokenHash = this.hash(token);
    const pending = this.identityState.pending.find((entry) => entry.tokenHash === tokenHash);
    if (!pending) throw new Error("verification_invalid_or_expired");
    this.identityState.pending = this.identityState.pending.filter((entry) => entry !== pending);
    const accessToken = randomBytes(32).toString("base64url");
    // Keep a small number of active devices per address instead of growing the
    // credentials file without a bound after every confirmation.
    const sameEmail = this.identityState.credentials.filter((entry) => entry.email === pending.email);
    const retainedIds = new Set(sameEmail.slice(-4).map((entry) => entry.id));
    this.identityState.credentials = this.identityState.credentials.filter(
      (entry) => entry.email !== pending.email || retainedIds.has(entry.id),
    );
    this.identityState.credentials.push({
      id: randomUUID(),
      tokenHash: this.hash(accessToken),
      email: pending.email,
      createdAt: new Date(this.now()).toISOString(),
    });
    await this.persistIdentities();
    return { accessToken, email: pending.email };
  }

  async credentialFor(accessToken: string): Promise<{ id: string; email: string } | undefined> {
    await this.initialize();
    const hash = this.hash(accessToken);
    return this.identityState.credentials.find((entry) => entry.tokenHash === hash);
  }

  async programSettingsFor(accessToken: string): Promise<{ interfaceLanguage: "ru" | "de" | "en" | "uk" } | undefined> {
    const credential = await this.credentialFor(accessToken);
    if (!credential) return undefined;
    return this.identityState.settingsByEmail[credential.email] ?? { interfaceLanguage: "ru" };
  }

  async saveProgramSettings(
    accessToken: string,
    settings: { interfaceLanguage: "ru" | "de" | "en" | "uk" },
  ): Promise<{ interfaceLanguage: "ru" | "de" | "en" | "uk" } | undefined> {
    const credential = await this.credentialFor(accessToken);
    if (!credential) return undefined;
    this.identityState.settingsByEmail[credential.email] = settings;
    await this.persistIdentities();
    return settings;
  }

  async createProject(project: unknown, ownerCredentialId: string): Promise<StoredSharedProject> {
    await this.initialize();
    const now = new Date(this.now()).toISOString();
    const stored: StoredSharedProject = {
      id: randomUUID(),
      project,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      ownerCredentialId,
    };
    await this.atomicWrite(this.projectFile(stored.id), stored);
    return stored;
  }

  async copyProject(projectId: string): Promise<StoredSharedProject> {
    const source = await this.readProject(projectId);
    if (!source) throw new Error("project_not_found");
    return this.createProject(source.project, source.ownerCredentialId);
  }

  async readProject(projectId: string): Promise<StoredSharedProject | undefined> {
    await this.initialize();
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return undefined;
    try {
      return JSON.parse(await readFile(this.projectFile(projectId), "utf8")) as StoredSharedProject;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  private projectFile(projectId: string): string {
    return resolve(this.projectsDirectory, `${projectId}.json`);
  }

  acquireLease(projectId: string, editorId: string, editorLabel: string): ProjectLease | undefined {
    const current = this.activeLease(projectId);
    if (current && current.editorId !== editorId) return undefined;
    const now = this.now();
    const lease: ProjectLease = {
      projectId,
      token: randomBytes(32).toString("base64url"),
      editorId,
      editorLabel: editorLabel.slice(0, 80),
      lastSeenAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.leaseDurationMs).toISOString(),
    };
    this.leases.set(projectId, lease);
    return lease;
  }

  activeLease(projectId: string): ProjectLease | undefined {
    const lease = this.leases.get(projectId);
    if (!lease) return undefined;
    if (Date.parse(lease.expiresAt) <= this.now()) {
      this.leases.delete(projectId);
      return undefined;
    }
    return lease;
  }

  refreshLease(projectId: string, token: string): ProjectLease | undefined {
    const lease = this.activeLease(projectId);
    if (!lease || lease.token !== token) return undefined;
    const now = this.now();
    lease.lastSeenAt = new Date(now).toISOString();
    lease.expiresAt = new Date(now + this.leaseDurationMs).toISOString();
    return lease;
  }

  releaseLease(projectId: string, token: string): boolean {
    const lease = this.activeLease(projectId);
    if (!lease || lease.token !== token) return false;
    this.leases.delete(projectId);
    return true;
  }

  async updateProject(
    projectId: string,
    token: string,
    baseRevision: number,
    project: unknown,
  ): Promise<StoredSharedProject> {
    const lease = this.refreshLease(projectId, token);
    if (!lease) throw new Error("lease_required");
    const stored = await this.readProject(projectId);
    if (!stored) throw new Error("project_not_found");
    if (stored.revision !== baseRevision) throw new Error("revision_conflict");
    stored.project = project;
    stored.revision += 1;
    stored.updatedAt = new Date(this.now()).toISOString();
    await this.atomicWrite(this.projectFile(projectId), stored);
    return stored;
  }

  async createPdfUpload(
    ownerCredentialId: string,
    requestedFileName: string,
    totalSize: number,
    chunkSize = 4 * 1024 * 1024,
  ): Promise<{ upload: PdfUploadRecord; uploadToken: string }> {
    await this.initialize();
    const id = randomUUID();
    const uploadToken = randomBytes(32).toString("base64url");
    const fileName = requestedFileName
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 160) || "calendar.pdf";
    const upload: PdfUploadRecord = {
      id,
      uploadTokenHash: this.hash(uploadToken),
      ownerCredentialId,
      fileName: fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`,
      totalSize,
      chunkSize,
      createdAt: new Date(this.now()).toISOString(),
    };
    await mkdir(this.pdfUploadChunksDirectory(id), { recursive: true });
    await this.atomicWrite(this.pdfUploadMetadataFile(id), upload);
    return { upload, uploadToken };
  }

  async readPdfUpload(uploadId: string): Promise<PdfUploadRecord | undefined> {
    await this.initialize();
    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) return undefined;
    try {
      return JSON.parse(await readFile(this.pdfUploadMetadataFile(uploadId), "utf8")) as PdfUploadRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async writePdfChunk(uploadId: string, uploadToken: string, index: number, bytes: Buffer): Promise<void> {
    const upload = await this.readPdfUpload(uploadId);
    if (!upload || upload.completedAt || upload.uploadTokenHash !== this.hash(uploadToken)) {
      throw new Error("upload_required");
    }
    const chunkCount = Math.ceil(upload.totalSize / upload.chunkSize);
    if (!Number.isInteger(index) || index < 0 || index >= chunkCount) throw new Error("invalid_chunk");
    const expectedSize = index === chunkCount - 1
      ? upload.totalSize - index * upload.chunkSize
      : upload.chunkSize;
    if (bytes.length !== expectedSize) throw new Error("invalid_chunk_size");
    await writeFile(resolve(this.pdfUploadChunksDirectory(uploadId), `${index}.part`), bytes, { mode: 0o600 });
  }

  async completePdfUpload(uploadId: string, uploadToken: string): Promise<PdfUploadRecord> {
    const upload = await this.readPdfUpload(uploadId);
    if (!upload || upload.uploadTokenHash !== this.hash(uploadToken)) throw new Error("upload_required");
    if (upload.completedAt) return upload;
    const target = this.pdfExportFile(upload);
    await writeFile(target, Buffer.alloc(0), { mode: 0o600 });
    const chunkCount = Math.ceil(upload.totalSize / upload.chunkSize);
    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = await readFile(resolve(this.pdfUploadChunksDirectory(uploadId), `${index}.part`));
      await appendFile(target, chunk);
    }
    const result = await stat(target);
    if (result.size !== upload.totalSize) throw new Error("upload_incomplete");
    upload.completedAt = new Date(this.now()).toISOString();
    await this.atomicWrite(this.pdfUploadMetadataFile(uploadId), upload);
    const chunksDirectory = this.pdfUploadChunksDirectory(uploadId);
    if (resolve(chunksDirectory).startsWith(resolve(this.pdfDirectory) + "\\") || resolve(chunksDirectory).startsWith(resolve(this.pdfDirectory) + "/")) {
      await rm(chunksDirectory, { recursive: true, force: true });
    }
    return upload;
  }

  pdfExportFile(upload: PdfUploadRecord): string {
    return resolve(this.pdfUploadDirectory(upload.id), upload.fileName);
  }

  private pdfUploadDirectory(uploadId: string): string {
    return resolve(this.pdfDirectory, uploadId);
  }

  private pdfUploadChunksDirectory(uploadId: string): string {
    return resolve(this.pdfUploadDirectory(uploadId), "chunks");
  }

  private pdfUploadMetadataFile(uploadId: string): string {
    return resolve(this.pdfUploadDirectory(uploadId), "upload.json");
  }
}
