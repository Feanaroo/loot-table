import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Board, Bucket, Work } from "./api";
import { buildIndex, type Dataset } from "./engine/data";
import { combine, readFile, toFile } from "./transfer";

const data: Dataset = JSON.parse(readFileSync(new URL("../public/data.json", import.meta.url), "utf-8"));
const index = buildIndex(data);

const work = (title: string) => {
  const w = data.works.find((x) => x.title === title);
  if (!w) throw new Error(`no ${title} in the dataset`);
  return w;
};
const asWork = (title: string) => ({ ...work(title), tier: null, audibleUrl: "" }) as unknown as Work;
const empty = (): Record<Bucket, string[]> => ({ S: [], A: [], B: [], C: [], D: [], F: [], unplaced: [] });

describe("tier list files", () => {
  const board: Board = {
    S: [asWork("Dungeon Crawler Carl"), asWork("Cradle")],
    A: [asWork("Mother of Learning")],
    B: [],
    C: [],
    D: [],
    F: [],
    unplaced: [asWork("The Primal Hunter")],
  };

  it("reads back what it wrote", () => {
    const read = readFile(toFile(board), index);
    expect(read.tiers.S).toEqual([work("Dungeon Crawler Carl").key, work("Cradle").key]);
    expect(read.tiers.A).toEqual([work("Mother of Learning").key]);
    expect(read.tiers.unplaced).toEqual([work("The Primal Hunter").key]);
    expect(read.found).toBe(4);
    expect(read.missing).toEqual([]);
  });

  it("finds a series by title and author when its key changed, and names what it can't find", () => {
    const file = JSON.parse(toFile(board));
    file.tiers.S[0].key = "series:GONE";
    file.tiers.B = [{ key: "series:NOPE", title: "A Series Nobody Wrote", author: "Nobody" }];
    const read = readFile(JSON.stringify(file), index);
    expect(read.tiers.S[0]).toBe(work("Dungeon Crawler Carl").key);
    expect(read.missing).toEqual(["A Series Nobody Wrote"]);
  });

  it("refuses files that aren't tier lists", () => {
    expect(() => readFile("not json", index)).toThrow(/not JSON/);
    expect(() => readFile('{"works": []}', index)).toThrow(/isn't a tier list/);
  });

  it("replaces, or adds with the file's tier winning", () => {
    const mine = { ...empty(), S: ["a", "b"], C: ["c"] };
    const file = { ...empty(), A: ["b"], F: ["d"] };
    expect(combine(mine, file, true)).toEqual(file);
    expect(combine(mine, file, false)).toEqual({ ...empty(), S: ["a"], A: ["b"], C: ["c"], F: ["d"] });
  });
});
