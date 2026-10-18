import { describe, expect, it } from "vitest";
import { buildIndex, type Dataset } from "./data";
import { suggest, suggestFilter } from "./suggest";

const work = (key: string) => ({ key, core: true }) as Dataset["works"][number];
const tags = (...t: string[]) => ({ story: t });

const index = buildIndex({
  works: ["a", "b", "c", "d", "e", "f", "g", "h"].map(work),
  tags: {
    a: tags("time loop", "school"),
    b: tags("time loop", "school"),
    c: tags("harem"),
    d: tags("harem"),
    e: tags("school"),
    f: tags("progression"),
    g: tags("progression"),
    h: tags("progression"),
  },
  vocab: {},
  lists: [],
  quality: {},
} as unknown as Dataset);

describe("suggestFilter", () => {
  it("requires what the top tiers share, and excludes what the bottom tiers share", () => {
    const ranks = new Map([["a", 0], ["b", 1], ["c", 5], ["d", 4]]);
    expect(suggestFilter(index, ranks)).toEqual({
      "story:time loop": "in",
      "story:school": "in",
      "story:harem": "out",
    });
  });

  it("reads a pattern from a single series", () => {
    expect(suggestFilter(index, new Map([["a", 0]]))).toEqual({ "story:time loop": "in", "story:school": "in" });
  });

  it("doesn't exclude a tag the top tiers also have", () => {
    const ranks = new Map([["a", 0], ["b", 0], ["e", 5], ["c", 5]]);
    expect(suggestFilter(index, ranks)["story:school"]).toBe("in");
  });
});

describe("suggest", () => {
  const ranks = new Map([["a", 0], ["b", 1], ["c", 5], ["d", 4]]);

  it("says which of your series each tag comes from", () => {
    const { reasons } = suggest(index, ranks);
    expect(reasons).toContain("Prefers time loop: in a, b, which you rank high.");
    expect(reasons).toContain("Avoids harem: in c, d, which you rank low.");
  });

  it("leaves popularity alone unless your top series are mostly the less known", () => {
    expect(suggest(index, ranks).popularity).toBeNull();
  });

  it("excludes unfinished series when nearly all your top series are finished", () => {
    const withStatus = buildIndex({
      ...index.data,
      status: { a: ["complete", "", ""], b: ["standalone", "", ""], e: ["complete", "", ""] },
    });
    const s = suggest(withStatus, new Map([["a", 0], ["b", 0], ["e", 1]]));
    expect(s.filter["status:ongoing"]).toBe("out");
    expect(s.filter["status:complete"]).toBeUndefined();
  });
});
