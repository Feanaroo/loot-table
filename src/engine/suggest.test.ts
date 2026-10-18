import { describe, expect, it } from "vitest";
import { buildIndex, type Dataset } from "./data";
import { suggestFilter } from "./suggest";

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

  it("suggests nothing until there are two series to read a pattern from", () => {
    expect(suggestFilter(index, new Map([["a", 0], ["c", 5]]))).toEqual({});
  });

  it("doesn't exclude a tag the top tiers also have", () => {
    const ranks = new Map([["a", 0], ["b", 0], ["e", 5], ["c", 5]]);
    expect(suggestFilter(index, ranks)["story:school"]).toBe("in");
  });
});
