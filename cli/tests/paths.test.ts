import { describe, expect, test } from "bun:test";
import { posix as pathPosix, win32 as pathWin32 } from "node:path";
import { resolveConfigPath, resolveDestRoot } from "../src/core/paths";

const isWin32 = process.platform === "win32";
const nativePath = isWin32 ? pathWin32 : pathPosix;

describe("resolveDestRoot", () => {
  test("global target joins home + .config/opencode using the native separator", () => {
    const home = isWin32 ? "C:\\Users\\alice" : "/home/alice";
    const result = resolveDestRoot("global", "/ignored/cwd", home);
    expect(result).toBe(nativePath.join(home, ".config", "opencode"));
    expect(result).toContain(nativePath.sep);
  });

  test("project target joins cwd + .opencode", () => {
    const cwd = isWin32 ? "C:\\repos\\my-app" : "/repos/my-app";
    const result = resolveDestRoot("project", cwd, "/ignored/home");
    expect(result).toBe(nativePath.join(cwd, ".opencode"));
  });

  test("claude target joins cwd + .claude", () => {
    const cwd = isWin32 ? "C:\\repos\\my-app" : "/repos/my-app";
    const result = resolveDestRoot("claude", cwd, "/ignored/home");
    expect(result).toBe(nativePath.join(cwd, ".claude"));
  });

  test("accepts relative cwd for project and claude targets", () => {
    const cwd = "relative/sub/dir";
    expect(resolveDestRoot("project", cwd, "/ignored/home")).toBe(nativePath.join(cwd, ".opencode"));
    expect(resolveDestRoot("claude", cwd, "/ignored/home")).toBe(nativePath.join(cwd, ".claude"));
  });

  test("accepts relative home for the global target", () => {
    const home = "relative/home";
    expect(resolveDestRoot("global", "/ignored/cwd", home)).toBe(
      nativePath.join(home, ".config", "opencode"),
    );
  });

  test("handles paths containing spaces", () => {
    const cwd = isWin32 ? "C:\\Program Files\\my app" : "/home/my user/my app";
    expect(resolveDestRoot("project", cwd, "/ignored/home")).toBe(nativePath.join(cwd, ".opencode"));
  });

  test("normalizes a trailing separator on cwd/home", () => {
    const cwdWithTrailingSep = isWin32 ? "C:\\repos\\my-app\\" : "/repos/my-app/";
    const result = resolveDestRoot("project", cwdWithTrailingSep, "/ignored/home");
    expect(result).toBe(nativePath.join(cwdWithTrailingSep, ".opencode"));
    expect(result.endsWith(nativePath.sep + ".opencode")).toBe(true);
  });

  if (isWin32) {
    test("windows: preserves drive letters and backslashes", () => {
      const home = "D:\\Users\\bob";
      const result = resolveDestRoot("global", "C:\\repos\\proj", home);
      expect(result).toBe("D:\\Users\\bob\\.config\\opencode");
    });

    test("windows: supports UNC-style cwd paths", () => {
      const cwd = "\\\\server\\share\\project";
      const result = resolveDestRoot("project", cwd, "D:\\Users\\bob");
      expect(result).toBe(pathWin32.join(cwd, ".opencode"));
    });
  } else {
    test("posix: joins forward-slash paths without introducing backslashes", () => {
      const home = "/home/bob";
      const result = resolveDestRoot("global", "/repos/proj", home);
      expect(result).toBe("/home/bob/.config/opencode");
      expect(result).not.toContain("\\");
    });
  }
});

describe("resolveConfigPath", () => {
  test("global target places opencode.json directly under destRoot", () => {
    const destRoot = isWin32 ? "C:\\Users\\alice\\.config\\opencode" : "/home/alice/.config/opencode";
    expect(resolveConfigPath("global", destRoot)).toBe(nativePath.join(destRoot, "opencode.json"));
  });

  test("project target places opencode.json in the parent of destRoot (the project cwd)", () => {
    const cwd = isWin32 ? "C:\\repos\\my-app" : "/repos/my-app";
    const destRoot = nativePath.join(cwd, ".opencode");
    const configPath = resolveConfigPath("project", destRoot);
    expect(configPath).toBe(nativePath.join(cwd, "opencode.json"));
    expect(configPath).toBe(nativePath.join(nativePath.dirname(destRoot), "opencode.json"));
  });

  test("claude target has no config path", () => {
    const destRoot = isWin32 ? "C:\\repos\\my-app\\.claude" : "/repos/my-app/.claude";
    expect(resolveConfigPath("claude", destRoot)).toBeUndefined();
  });

  test("project target with a relative destRoot resolves the config path relative to its parent", () => {
    const destRoot = nativePath.join("relative", "cwd", ".opencode");
    expect(resolveConfigPath("project", destRoot)).toBe(nativePath.join("relative", "cwd", "opencode.json"));
  });
});
