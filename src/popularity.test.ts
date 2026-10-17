import { readFileSync } from "node:fs";
import { describe as group, expect, it } from "vitest";
import { buildIndex, type Dataset } from "./engine/data";
import { describe, within } from "./popularity";

const data: Dataset = JSON.parse(readFileSync(new URL("../public/data.json", import.meta.url), "utf-8"));
const index = buildIndex(data);
const ranked = data.works.filter((w) => w.core && (index.appearances.get(w.key) ?? 0) > 0);
const work = (title: string) => data.works.find((w) => w.title === title)!;

group("popularity slider", () => {
  it("keeps everything at its widest", () => {
    const keep = within(index, { mode: "combined", min: 0, max: 100 });
    expect(ranked.every(keep)).toBe(true);
    expect(describe(index, { mode: "lists", min: 0, max: 100 })).toBe("Any popularity");
  });

  it("niche end: drops the best known, keeps ties together", () => {
    const keep = within(index, { mode: "lists", min: 0, max: 40 });
    expect(keep(work("Dungeon Crawler Carl"))).toBe(false);
    // Every series in exactly one list is in, or none is: the boundary is a value, not a count
    const once = ranked.filter((w) => index.appearances.get(w.key) === 1);
    expect(new Set(once.map(keep)).size).toBe(1);
    expect(describe(index, { mode: "lists", min: 0, max: 40 })).toMatch(/^In up to \d+ Reddit tier lists?$/);
  });

  it("popular end, by Audible ratings", () => {
    const keep = within(index, { mode: "ratings", min: 90, max: 100 });
    expect(keep(work("Dungeon Crawler Carl"))).toBe(true);
    const kept = ranked.filter(keep).length / ranked.length;
    expect(kept).toBeGreaterThan(0.05);
    expect(kept).toBeLessThan(0.15);
    expect(describe(index, { mode: "ratings", min: 90, max: 100 })).toMatch(/^[\d,]+\+ Audible ratings$/);
  });

  it("doesn't pass series without a rating count off as obscure", () => {
    const shadowSlave = work("Shadow Slave");
    expect(shadowSlave.ratingCount ?? 0).toBe(0);
    expect(within(index, { mode: "ratings", min: 0, max: 30 })(shadowSlave)).toBe(false);
    expect(within(index, { mode: "ratings", min: 0, max: 100 })(shadowSlave)).toBe(true);
  });

  it("describes the combined measure as shares", () => {
    expect(describe(index, { mode: "combined", min: 0, max: 30 })).toBe("The 30% least known");
    expect(describe(index, { mode: "combined", min: 80, max: 100 })).toBe("The 20% best known");
  });
});
