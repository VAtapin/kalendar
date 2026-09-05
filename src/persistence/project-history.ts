import type { CalendarProject, DocumentAsset } from "../document/types";

const ASSET_TOKEN_PREFIX = "history-asset:";
const TOKENIZED_KINDS = new Set<DocumentAsset["kind"]>(["image", "svg", "font", "icc-profile"]);

/**
 * Serializes undo snapshots without copying large data URLs into every entry.
 * The editable project and the codec pool each retain one reference to a source,
 * while history strings contain only short stable tokens.
 */
export class ProjectHistoryCodec {
  private nextToken = 1;
  private readonly sourceToToken = new Map<string, string>();
  private readonly tokenToSource = new Map<string, string>();

  serialize(project: CalendarProject): string {
    const codec = this;
    return JSON.stringify({ ...project, calendarData: null }, function (key, value: unknown) {
      if (
        key === "source" &&
        typeof value === "string" &&
        value.startsWith("data:") &&
        this &&
        typeof this === "object" &&
        TOKENIZED_KINDS.has((this as DocumentAsset).kind)
      ) {
        let token = codec.sourceToToken.get(value);
        if (!token) {
          token = `${ASSET_TOKEN_PREFIX}${codec.nextToken}`;
          codec.nextToken += 1;
          codec.sourceToToken.set(value, token);
          codec.tokenToSource.set(token, value);
        }
        return token;
      }
      return value;
    });
  }

  deserialize(snapshot: string): CalendarProject {
    return JSON.parse(snapshot, (_key, value: unknown) => {
      if (typeof value !== "string" || !value.startsWith(ASSET_TOKEN_PREFIX)) return value;
      const source = this.tokenToSource.get(value);
      if (!source) throw new Error("История проекта повреждена: исходный файл больше недоступен");
      return source;
    }) as CalendarProject;
  }

  /** Releases files no longer reachable from the document or retained undo entries. */
  prune(snapshots: Iterable<string>, project: CalendarProject): void {
    const retainedTokens = new Set<string>();
    for (const snapshot of snapshots) {
      for (const token of snapshot.match(/history-asset:\d+/gu) ?? []) retainedTokens.add(token);
    }
    for (const asset of project.assets) {
      const token = this.sourceToToken.get(asset.source);
      if (token) retainedTokens.add(token);
    }
    for (const [token, source] of this.tokenToSource) {
      if (retainedTokens.has(token)) continue;
      this.tokenToSource.delete(token);
      this.sourceToToken.delete(source);
    }
  }

  clear(): void {
    this.nextToken = 1;
    this.sourceToToken.clear();
    this.tokenToSource.clear();
  }
}
