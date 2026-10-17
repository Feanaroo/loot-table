/** The dataset (public/data.json) and indexes over it, loaded once. */

export interface DataWork {
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
  categories: string[];
  /** false: mainstream fantasy / sci-fi. Rankable, never recommended. */
  core: boolean;
  /** Times named in a Reddit tier list */
  mentions: number;
  /** Same series listed twice on Audible shares this */
  ident: string;
  /** Permanent number, never reused: what share links are made of */
  sid: number;
}

/** [asin, title, sequence, year, runtime in minutes, rating] */
export type BookRow = [string, string, string | null, string | null, number | null, number | null];
/** [work key, tier rank (0 = best), tier label as written] */
export type ListEntry = [string, number, string];
export type StoryTags = Record<string, string[]>;

export interface Dataset {
  format: number;
  builtAt: string;
  vocab: Record<string, string[]>;
  works: DataWork[];
  tags: Record<string, StoryTags>;
  books: Record<string, BookRow[]>;
  lists: ListEntry[][];
  /** Community strength per work (Bradley-Terry log-strength, 0 = average) */
  quality: Record<string, number>;
  /** Is the series finished, as of builtAt: [state, text, based on], e.g. ["complete", "Finished 2023", "blurb"].
   * state: complete | ongoing | quiet | abandoned | standalone; based on: blurb | dates | claude | manual */
  status?: Record<string, [string, string, string]>;
}

export interface CommunityList {
  ranks: Map<string, number>;
  /** Number of tiers with works in them */
  tiers: number;
}

export interface Index {
  data: Dataset;
  works: Map<string, DataWork>;
  lists: CommunityList[];
  /** Work key -> how many lists rank it */
  appearances: Map<string, number>;
  /** Work key -> position in the community ranking (1 = best) */
  qualityOrder: Map<string, number>;
  /** Work key -> its placements: tier label and rank, and how many tiers that list had */
  placements: Map<string, { label: string; rank: number; tiers: number }[]>;
  /** Work key -> tags as "group:tag" */
  tagSets: Map<string, Set<string>>;
  /** Permanent number (share links) -> work key */
  bySid: Map<number, string>;
}

/** Best community strength first; ties by key, so the order is the same everywhere */
export const byQuality = (quality: Record<string, number>) => (a: string, b: string) =>
  quality[b] - quality[a] || (a < b ? -1 : a > b ? 1 : 0);

let loading: Promise<Index> | null = null;

export function loadIndex(): Promise<Index> {
  loading ??= fetch(`${import.meta.env.BASE_URL}data.json?v=${__DATA_VERSION__}`)
    .then((r) => {
      if (!r.ok) throw new Error(`Couldn't load the data (${r.status})`);
      return r.json() as Promise<Dataset>;
    })
    .then(buildIndex);
  return loading;
}

export function buildIndex(data: Dataset): Index {
  const works = new Map(data.works.map((w) => [w.key, w]));
  const appearances = new Map<string, number>();
  const placements: Index["placements"] = new Map();
  const lists = data.lists.map((entries) => {
    const ranks = new Map(entries.map(([k, rank]) => [k, rank]));
    const tiers = new Set(ranks.values()).size;
    for (const [k, rank, label] of entries) {
      appearances.set(k, (appearances.get(k) ?? 0) + 1);
      if (!placements.has(k)) placements.set(k, []);
      placements.get(k)!.push({ label, rank, tiers });
    }
    return { ranks, tiers };
  });
  const qualityOrder = new Map(
    Object.keys(data.quality)
      .sort(byQuality(data.quality))
      .map((k, i) => [k, i + 1]),
  );
  const tagSets = new Map(
    Object.entries(data.tags).map(([k, groups]) => [
      k,
      new Set(Object.entries(groups).flatMap(([g, ts]) => ts.map((t) => `${g}:${t}`))),
    ]),
  );
  const bySid = new Map(data.works.map((w) => [w.sid, w.key]));
  return { data, works, lists, appearances, qualityOrder, placements, tagSets, bySid };
}
