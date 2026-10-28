// @vitest-environment node
import { describe, expect, it } from "vitest";
import { pathInsideRoot } from "./path_inside_root";

describe("pathInsideRoot", () => {
  it("gives the path relative to the root", () => {
    expect(pathInsideRoot("/me/repo", "/me/repo/packages/web/package.json")).toBe("packages/web/package.json");
    expect(pathInsideRoot("/me/repo/", "/me/repo/package.json")).toBe("package.json");
  });

  it("gives null for the root itself and for a path outside the root", () => {
    expect(pathInsideRoot("/me/repo", "/me/repo")).toBeNull();
    expect(pathInsideRoot("/me/repo", "/me/other/package.json")).toBeNull();
    expect(pathInsideRoot("/me/repo", "/me/repository/package.json")).toBeNull();
  });
});
