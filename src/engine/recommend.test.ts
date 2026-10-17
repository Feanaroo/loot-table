// The scoring was first written in Python (the private data pipeline); this checks the port
// gives the same picks, scores and reasons for a real tier list.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIndex, type Dataset } from "./data";
import { recommend, TIERS } from "./recommend";
import expected from "./__fixtures__/python-recs.json";

const data: Dataset = JSON.parse(readFileSync(new URL("../../public/data.json", import.meta.url), "utf-8"));
const index = buildIndex(data);

describe("recommend", () => {
  const board = expected.board as Record<string, string[]>;
  const ranks = new Map<string, number>();
  const listened = new Set<string>();
  for (const [bucket, keys] of Object.entries(board)) {
    for (const k of keys) {
      listened.add(k);
      const i = TIERS.indexOf(bucket as (typeof TIERS)[number]);
      if (i >= 0) ranks.set(k, i);
    }
  }
  const recs = recommend(index, ranks, listened).slice(0, expected.top.length);

  it("picks the same series in the same order as the Python version", () => {
    expect(recs.map((r) => r.key)).toEqual(expected.top.map((r) => r.key));
  });

  it("gives the same scores and reasons", () => {
    recs.forEach((r, i) => {
      expect(r.score).toBeCloseTo(expected.top[i].score, 6);
      expect(r.reasons).toEqual(expected.top[i].reasons);
    });
  });

  it("never recommends what's on my list, or mainstream fantasy", () => {
    const all = recommend(index, ranks, listened);
    expect(all.some((r) => listened.has(r.key))).toBe(false);
    expect(all.some((r) => !index.works.get(r.key)!.core)).toBe(false);
  });
});
