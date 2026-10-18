import { describe, expect, it } from "vitest";
import { pagePath } from "./analytics";

describe("analytics page paths", () => {
  it("names the page, and never sends a shared list", () => {
    expect(pagePath("")).toBe("/tierlist");
    expect(pagePath("#/foryou")).toBe("/foryou");
    expect(pagePath("#/community")).toBe("/community");
    expect(pagePath("#s=2ADAC.AAAEAK.AB...AF&t=My+list")).toBe("/shared");
    expect(pagePath("#/something-else")).toBe("/tierlist");
  });
});
