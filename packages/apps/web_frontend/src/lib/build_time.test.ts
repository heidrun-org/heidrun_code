// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatBuildTime, versionWithBuildTime } from "./build_time";

describe("formatBuildTime", () => {
  it("writes the year with 4 characters, then each other part with 2 characters, on the 24-hour clock", () => {
    expect(formatBuildTime(new Date(2026, 9, 15, 14, 30, 5))).toBe("20261015-143005");
  });

  it("adds a leading zero to the month, the day, the hours, the minutes, and the seconds", () => {
    expect(formatBuildTime(new Date(2026, 0, 2, 3, 4, 5))).toBe("20260102-030405");
  });

  it("writes midnight as 00 hours, and the last second of the day as 23 hours 59 minutes 59 seconds", () => {
    expect(formatBuildTime(new Date(2026, 11, 31, 0, 0, 0))).toBe("20261231-000000");
    expect(formatBuildTime(new Date(2026, 11, 31, 23, 59, 59))).toBe("20261231-235959");
  });
});

describe("versionWithBuildTime", () => {
  it("puts the version, a dash, and the build time together", () => {
    expect(versionWithBuildTime("0.2.5", "20261015-143005")).toBe("0.2.5-20261015-143005");
  });

  it("returns an empty text when the version is not known", () => {
    expect(versionWithBuildTime("", "20261015-143005")).toBe("");
  });
});
