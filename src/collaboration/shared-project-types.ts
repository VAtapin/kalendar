import type { CalendarProject, ProgramSettings } from "../document/types";
import type { GlobalCalendarGridTemplate } from "../templates/calendar-grid-presets";

export interface SharedEditorPresence {
  label: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface SharedProjectLease {
  projectId: string;
  leaseToken: string;
  revision: number;
  expiresAt: string;
}

export interface SharedProjectLeaseGranted extends SharedProjectLease {
  status: "editing";
  project: CalendarProject;
}

export interface SharedProjectLocked {
  status: "locked";
  projectId: string;
  project: CalendarProject;
  revision: number;
  editor: SharedEditorPresence;
}

export type SharedProjectOpenResult = SharedProjectLeaseGranted | SharedProjectLocked;

export interface SharedProjectCreated extends SharedProjectLeaseGranted {
  shareUrl: string;
}

export interface EmailVerificationRequested {
  sent: true;
  expiresAt: string;
  developmentVerificationUrl?: string;
}

export interface EmailVerificationConfirmed {
  accessToken: string;
  email: string;
}

export type UserProgramSettings = ProgramSettings;

export interface GlobalCalendarGridTemplatesResult {
  templates: GlobalCalendarGridTemplate[];
  canManage: boolean;
}

export interface PdfUploadCreated {
  uploadId: string;
  uploadToken: string;
  chunkSize: number;
}

export interface PdfExportReady {
  downloadUrl: string;
  fileName: string;
  size: number;
}
