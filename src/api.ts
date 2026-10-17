/** What the pages call. Everything runs here in the app: the dataset is loaded once, and your
 * tier list lives in this browser / app's local storage. */

import { byQuality, loadIndex, type DataWork, type Index } from "./engine/data";
import { neighbourWeights, recommend, TIERS as ENGINE_TIERS } from "./engine/recommend";
import { norm, similarity } from "./engine/text";
import { decode, encode } from "./share";
import { readFile } from "./transfer";

export const TIERS = ENGINE_TIERS;
export type Tier = (typeof TIERS)[number];
export type Bucket = Tier | "unplaced";

/** What kind of story a work is, by group (setting, story, lead, tone); null until tagged */
export type StoryTags = Record<string, string[]> | null;

export interface Work {
  key: string;
  title: string;
  authors: string[];
  narrators: string[];
  bookCount: number;
  firstAsin: string;
  image: string | null;
  rating: number | null;
  ratingCount: number | null;
  runtimeMin: number | null;
  firstRelease: string | null;
  lastRelease: string | null;
  tier: Tier | null;
  audibleUrl: string;
  status: SeriesStatus | null;
}

/** Is the series finished: complete | ongoing | quiet (no book in 2 years) | abandoned | standalone */
export interface SeriesStatus {
  state: string;
  detail: string;
  /** What it's based on: blurb | dates | claude | manual */
  source: string;
}

/** The statuses, in the order the filter shows them */
export const STATUS_STATES = ["complete", "ongoing", "quiet", "abandoned", "standalone"];

export interface Book {
  asin: string;
  title: string;
  year: string | null;
  runtimeMin: number | null;
  rating: number | null;
  sequence: string | null;
}

export interface WorkDetail extends Work {
  tags: StoryTags;
  books: Book[];
  /** Placements in Reddit tier lists (anonymous): tier label, rank, and how many tiers the list had */
  community: { label: string; rank: number; tiers: number }[];
}

export interface Recommendation extends Work {
  score: number;
  reasons: string[];
  quality: number | null;
  neighbourSupport: number;
  tags: StoryTags;
}

export interface Recommendations {
  communityLists: number;
  neighbours: number;
  /** Picks that pass the tag filters, before the limit */
  matching: number;
  /** "group:tag" -> how many matching picks have it */
  tagCounts: Record<string, number>;
  items: Recommendation[];
}

export interface CommunityWork extends Work {
  quality: number;
  lists: number;
}

export type Board = Record<Bucket, Work[]>;

const STORAGE_KEY = "loot-table.tierlist";
type StoredBoard = Partial<Record<Bucket, string[]>>;

function readStored(): StoredBoard {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

let statuses: Record<string, [string, string, string]> = {};

function toWork(w: DataWork, tier: Tier | null = null): Work {
  const st = statuses[w.key];
  return {
    key: w.key,
    title: w.title,
    authors: w.authors,
    narrators: w.narrators,
    bookCount: w.bookCount,
    firstAsin: w.firstAsin,
    image: w.image,
    rating: w.rating,
    ratingCount: w.ratingCount,
    runtimeMin: w.runtimeMin,
    firstRelease: w.firstRelease,
    lastRelease: w.lastRelease,
    tier,
    audibleUrl: `https://www.audible.co.uk/pd/${w.firstAsin}`,
    status: st ? { state: st[0], detail: st[1], source: st[2] } : null,
  };
}

/** The dataset, with its statuses at hand for toWork */
async function load(): Promise<Index> {
  const index = await loadIndex();
  statuses = index.data.status ?? {};
  return index;
}

/** What For You filters by: the story tags, plus "status:complete" etc. (kept out of tagSets, which
 * the scoring uses) */
function filterTags(index: Index, key: string): Set<string> {
  const tags = new Set(index.tagSets.get(key) ?? []);
  const st = index.data.status?.[key];
  if (st) tags.add(`status:${st[0]}`);
  return tags;
}

/** My placed works -> tier rank (0 = S), and everything on my list */
function myRanks(): { ranks: Map<string, number>; listened: Set<string> } {
  const ranks = new Map<string, number>();
  const listened = new Set<string>();
  for (const [bucket, keys] of Object.entries(readStored())) {
    for (const k of keys ?? []) {
      listened.add(k);
      const i = TIERS.indexOf(bucket as Tier);
      if (i >= 0) ranks.set(k, i);
    }
  }
  return { ranks, listened };
}

function tierOf(): Map<string, Tier | null> {
  const out = new Map<string, Tier | null>();
  for (const [bucket, keys] of Object.entries(readStored())) {
    for (const k of keys ?? []) out.set(k, bucket === "unplaced" ? null : (bucket as Tier));
  }
  return out;
}

function search(index: Index, q: string, limit: number): Work[] {
  const mine = tierOf();
  const term = q.trim().toLowerCase();
  const byPopularity = (a: DataWork, b: DataWork) =>
    b.mentions - a.mentions || (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
  let hits: DataWork[];
  if (!term) {
    // The series Reddit ranks most, and only the genre itself: mainstream fantasy is found by searching
    hits = index.data.works.filter((w) => w.core).sort(byPopularity);
  } else {
    const n = norm(term);
    const has = (s: string) => s.toLowerCase().includes(term);
    hits = index.data.works.filter((w) => has(w.title) || w.authors.some(has) || w.narrators.some(has));
    const starts = (w: DataWork) => Number(!!n && norm(w.title).startsWith(n));
    hits.sort((a, b) => starts(b) - starts(a) || byPopularity(a, b));
    if (!hits.length && n) {
      // Typos, missing words: a fuzzy title search
      hits = index.data.works
        .map((w) => ({ w, s: similarity(n, norm(w.title)) }))
        .filter((x) => x.s >= 0.55)
        .sort((a, b) => b.s - a.s || byPopularity(a.w, b.w))
        .map((x) => x.w);
    }
  }
  return hits.slice(0, limit).map((w) => toWork(w, mine.get(w.key) ?? null));
}

export const api = {
  search: async (q: string, limit = 30) => search(await load(), q, limit),

  work: async (key: string): Promise<WorkDetail> => {
    const index = await load();
    const w = index.works.get(key);
    if (!w) throw new Error("No such series");
    const rows = index.data.books[key] ?? [
      [w.firstAsin, w.title, null, w.firstRelease?.slice(0, 4) ?? null, w.runtimeMin, w.rating],
    ];
    return {
      ...toWork(w, tierOf().get(key) ?? null),
      tags: index.data.tags[key] ?? null,
      books: rows.map(([asin, title, sequence, year, runtimeMin, rating]) => ({
        asin,
        title,
        sequence,
        year,
        runtimeMin,
        rating,
      })),
      // Best placements first, relative to each list's own number of tiers
      community: [...(index.placements.get(key) ?? [])].sort(
        (a, b) => a.rank / Math.max(1, a.tiers - 1) - b.rank / Math.max(1, b.tiers - 1),
      ),
    };
  },

  board: async (): Promise<Board> => {
    const index = await load();
    const board: Board = { S: [], A: [], B: [], C: [], D: [], F: [], unplaced: [] };
    for (const [bucket, keys] of Object.entries(readStored()) as [Bucket, string[]][]) {
      if (!(bucket in board)) continue;
      for (const k of keys ?? []) {
        const w = index.works.get(k); // a series dropped from a newer dataset just disappears
        if (w) board[bucket].push(toWork(w, bucket === "unplaced" ? null : bucket));
      }
    }
    return board;
  },

  saveBoard: async (board: Board) => {
    const stored = Object.fromEntries(Object.entries(board).map(([t, ws]) => [t, ws.map((w) => w.key)]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  },

  /** A tier list file, matched against the dataset (transfer.ts) */
  readTierlistFile: async (text: string) => readFile(text, await load()),

  /** The share link fragment for my list (share.ts) */
  shareFragment: async (title = "") => encode(readStored(), await load(), title),

  /** A shared list from a link, as works; null if the link isn't one */
  readShared: async (fragment: string) => {
    const index = await load();
    const shared = decode(fragment, index);
    if (!shared) return null;
    const mine = tierOf();
    const board = Object.fromEntries(
      Object.entries(shared.tiers).map(([b, keys]) => [
        b,
        keys.map((k) => toWork(index.works.get(k)!, mine.get(k) ?? null)),
      ]),
    ) as Board;
    return { board, keys: shared.tiers, title: shared.title, missing: shared.missing };
  },

  /** Store a list given as keys, e.g. an imported one */
  saveKeys: async (tiers: Record<Bucket, string[]>) => localStorage.setItem(STORAGE_KEY, JSON.stringify(tiers)),

  recommendations: async (include: string[] = [], exclude: string[] = [], limit = 60): Promise<Recommendations> => {
    const index = await load();
    const { ranks, listened } = myRanks();
    let recs = recommend(index, ranks, listened);
    if (include.length || exclude.length) {
      recs = recs.filter((r) => {
        const tags = filterTags(index, r.key);
        return include.every((t) => tags.has(t)) && !exclude.some((t) => tags.has(t));
      });
    }
    // How many of the matching picks have each tag, for the filter bar
    const tagCounts: Record<string, number> = {};
    for (const r of recs) for (const t of filterTags(index, r.key)) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    return {
      communityLists: index.lists.length,
      neighbours: neighbourWeights(index, ranks).size,
      matching: recs.length,
      tagCounts,
      items: recs.slice(0, limit).map((r) => ({
        ...toWork(index.works.get(r.key)!),
        score: r.score,
        reasons: r.reasons,
        quality: r.quality,
        neighbourSupport: r.neighbourSupport,
        tags: index.data.tags[r.key] ?? null,
      })),
    };
  },

  /** The community's top series; mainstream fantasy (Stormlight, Harry Potter) only on request */
  community: async (includeMainstream = false, limit = 100): Promise<CommunityWork[]> => {
    const index = await load();
    const mine = tierOf();
    const quality = index.data.quality;
    return Object.keys(quality)
      .filter((k) => includeMainstream || index.works.get(k)?.core)
      .sort(byQuality(quality))
      .slice(0, limit)
      .flatMap((k) => {
        const w = index.works.get(k);
        return w ? [{ ...toWork(w, mine.get(k) ?? null), quality: quality[k], lists: index.appearances.get(k) ?? 0 }] : [];
      });
  },

  /** The filter's groups: whether the series is finished, then the story tags */
  tags: async () => ({ status: STATUS_STATES, ...(await load()).data.vocab }),

  /** When the dataset was built */
  builtAt: async () => (await load()).data.builtAt,
};

export const hours = (min: number | null) => (min ? `${Math.round(min / 60)} h` : "");
