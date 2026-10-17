import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIndex, type Dataset } from "./engine/data";
import { decode, encode } from "./share";

const data: Dataset = JSON.parse(readFileSync(new URL("../public/data.json", import.meta.url), "utf-8"));
const index = buildIndex(data);
const key = (title: string) => data.works.find((w) => w.title === title)!.key;

describe("share links", () => {
  const tiers = {
    S: [key("Dungeon Crawler Carl"), key("Cradle"), key("He Who Fights with Monsters")],
    A: [key("Mother of Learning")],
    B: [],
    C: [key("The Primal Hunter")],
    D: [],
    F: [],
    unplaced: [key("Mark of the Fool")],
  };

  it("round-trips a list, without the Listened row", () => {
    const link = encode(tiers, index);
    const back = decode(link, index)!;
    expect(back.tiers).toEqual({ ...tiers, unplaced: [] });
    expect(back.missing).toBe(0);
  });

  it("is short: two characters a series, a dot a tier, nothing for empty tiers at the end", () => {
    // 5 series in S..C: "s=" + width digit + 10 characters + 3 dots
    expect(encode(tiers, index)).toMatch(/^s=2[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{2}\.\.[A-Za-z0-9_-]{2}$/);
  });

  it("carries a title, with + for spaces", () => {
    const link = encode(tiers, index, "My top picks & more");
    expect(link).toContain("&t=My+top+picks+%26+more");
    expect(decode(link, index)!.title).toBe("My top picks & more");
  });

  it("counts series this catalog doesn't have, and rejects links that aren't share links", () => {
    expect(decode("s=2__", index)!.missing).toBe(1); // number 4095: not assigned (yet)
    expect(decode("s=2abc", index)).toBeNull(); // not a whole number of codes
    expect(decode("/foryou", index)).toBeNull();
    expect(decode("s=9AA", index)).toBeNull();
  });
});
