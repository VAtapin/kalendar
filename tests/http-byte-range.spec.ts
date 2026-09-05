import { describe, expect, it } from "vitest";
import { parseHttpByteRange } from "../scripts/http-byte-range";

describe("HTTP byte range", () => {
  it("supports bounded, open-ended and suffix ranges", () => {
    expect(parseHttpByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseHttpByteRange("bytes=90-", 100)).toEqual({ start: 90, end: 99 });
    expect(parseHttpByteRange("bytes=-20", 100)).toEqual({ start: 80, end: 99 });
    expect(parseHttpByteRange("bytes=-200", 100)).toEqual({ start: 0, end: 99 });
  });

  it("rejects malformed and unsatisfiable ranges", () => {
    expect(parseHttpByteRange("bytes=100-", 100)).toBeNull();
    expect(parseHttpByteRange("bytes=20-10", 100)).toBeNull();
    expect(parseHttpByteRange("bytes=-0", 100)).toBeNull();
    expect(parseHttpByteRange("bytes=0-1,5-6", 100)).toBeNull();
  });

  it("returns undefined when no range was requested", () => {
    expect(parseHttpByteRange(undefined, 100)).toBeUndefined();
  });
});
