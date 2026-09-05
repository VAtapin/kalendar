import { describe, expect, it } from "vitest";
import { createBlankCalendarProject } from "../src/document/factories";
import { ProjectHistoryCodec } from "../src/persistence/project-history";

describe("project history codec", () => {
  it("keeps large embedded files out of undo strings and restores them exactly", () => {
    const project = createBlankCalendarProject();
    const source = `data:image/png;base64,${"A".repeat(2_000_000)}`;
    project.assets.push({ id: "large", name: "large.png", mimeType: "image/png", kind: "image", source });
    project.publisherProfile.logoAssetId = "large";
    const codec = new ProjectHistoryCodec();

    const first = codec.serialize(project);
    const second = codec.serialize(project);

    expect(first.length).toBeLessThan(20_000);
    expect(first).toBe(second);
    expect(codec.deserialize(first).assets.find((asset) => asset.id === "large")?.source).toBe(source);
  });

  it("drops its source pool when a different project is opened", () => {
    const project = createBlankCalendarProject();
    project.assets.push({ id: "old", name: "old.png", mimeType: "image/png", kind: "image", source: "data:image/png;base64,AA==" });
    project.publisherProfile.logoAssetId = "old";
    const codec = new ProjectHistoryCodec();
    const snapshot = codec.serialize(project);
    codec.clear();
    expect(() => codec.deserialize(snapshot)).toThrow(/история проекта повреждена/iu);
  });

  it("releases sources that are no longer present in retained undo entries", () => {
    const project = createBlankCalendarProject();
    const source = "data:image/png;base64,OLD";
    project.assets.push({ id: "old", name: "old.png", mimeType: "image/png", kind: "image", source });
    project.publisherProfile.logoAssetId = "old";
    const codec = new ProjectHistoryCodec();
    const snapshot = codec.serialize(project);
    project.assets = project.assets.filter((asset) => asset.id !== "old");
    project.publisherProfile.logoAssetId = undefined;

    codec.prune([], project);
    expect(() => codec.deserialize(snapshot)).toThrow(/история проекта повреждена/iu);
  });
});
