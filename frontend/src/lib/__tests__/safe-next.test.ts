import { describe, expect, it } from "vitest";
import { safeNext } from "../safe-next";

describe("safeNext", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNext("/me")).toBe("/me");
    expect(safeNext("/register?event=abc&x=1#top")).toBe("/register?event=abc&x=1#top");
  });

  it("rejects missing, absolute and protocol-relative targets", () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext("")).toBeNull();
    expect(safeNext("https://evil.com")).toBeNull();
    expect(safeNext("//evil.com")).toBeNull();
    expect(safeNext("javascript:alert(1)")).toBeNull();
  });

  it("rejects backslash and control-character tricks browsers resolve off-site", () => {
    expect(safeNext("/\\evil.com")).toBeNull();
    expect(safeNext("/\\\\evil.com")).toBeNull();
    expect(safeNext("/\t/evil.com")).toBeNull();
    expect(safeNext("/\n/evil.com")).toBeNull();
  });
});
