/** Scoring works for you, from five signals:
 *
 * 1. Community quality: a Bradley-Terry model over every "X is in a higher tier than Y" pair in
 *    Reddit tier lists (computed with the dataset, the same for everyone).
 * 2. Taste neighbours: each Reddit list is weighted by how well it agrees with your tier list on
 *    the works you both ranked; what your neighbours rank high scores high.
 * 3. Affinity: same author / narrator as works you rank high.
 * 4. Content: same kind of story (tags) as works you rank high, unlike the ones you rank low.
 * 5. Popularity: how many Reddit lists rank it, and how many Audible ratings it has.
 */

import type { DataWork, Index } from "./data";

export const TIERS = ["S", "A", "B", "C", "D", "F"] as const;

const MIN_NEIGHBOUR_PAIRS = 3; // shared ordered pairs before a list counts as a neighbour
// How much each of my tiers says "more like this" (S..B) or "less like this" (D, F)
const LIKE: Record<number, number> = { 0: 1.0, 1: 0.8, 2: 0.4 };
const DISLIKE: Record<number, number> = { 4: 0.5, 5: 1.0 };
const CONTENT_WEIGHT = 2.0;
const POPULARITY_WEIGHT = 1.5;

export interface Scored {
  key: string;
  score: number;
  quality: number | null;
  neighbourSupport: number;
  reasons: string[];
}

/** Cosine similarity of tag sets, rare tags (time loop) counting more than common ones (visible stats) */
export class Similarity {
  private idf = new Map<string, number>();
  private norms = new Map<string, number>();

  constructor(private tags: Map<string, Set<string>>) {
    const df = new Map<string, number>();
    for (const ts of tags.values()) for (const t of ts) df.set(t, (df.get(t) ?? 0) + 1);
    for (const [t, n] of df) this.idf.set(t, Math.log(tags.size / n) + 0.5);
    for (const [k, ts] of tags) {
      let sum = 0;
      for (const t of ts) sum += this.idf.get(t)! ** 2;
      this.norms.set(k, Math.sqrt(sum));
    }
  }

  of(a: string, b: string): number {
    const ta = this.tags.get(a);
    const tb = this.tags.get(b);
    const na = this.norms.get(a);
    const nb = this.norms.get(b);
    if (!ta || !tb || !na || !nb) return 0;
    let shared = 0;
    for (const t of ta) if (tb.has(t)) shared += this.idf.get(t)! ** 2;
    return shared / (na * nb);
  }

  /** The most telling tags two works share, rarest first */
  shared(a: string, b: string, n = 3): string[] {
    const tb = this.tags.get(b) ?? new Set();
    return [...(this.tags.get(a) ?? [])]
      .filter((t) => tb.has(t))
      .sort((x, y) => this.idf.get(y)! - this.idf.get(x)!)
      .slice(0, n)
      .map((t) => t.split(":").slice(1).join(":"));
  }
}

let similarityCache: { index: Index; sim: Similarity } | null = null;
const similarityFor = (index: Index) => {
  if (similarityCache?.index !== index) similarityCache = { index, sim: new Similarity(index.tagSets) };
  return similarityCache.sim;
};

/** List index -> agreement weight, for lists that order my works the way I do */
export function neighbourWeights(index: Index, myRanks: Map<string, number>): Map<number, number> {
  const out = new Map<number, number>();
  index.lists.forEach((cl, i) => {
    const shared = [...cl.ranks.keys()].filter((k) => myRanks.has(k));
    if (shared.length < 2) return;
    let agree = 0;
    let disagree = 0;
    for (let a = 0; a < shared.length; a++) {
      for (let b = a + 1; b < shared.length; b++) {
        const mine = myRanks.get(shared[a])! - myRanks.get(shared[b])!;
        const theirs = cl.ranks.get(shared[a])! - cl.ranks.get(shared[b])!;
        if (mine === 0 || theirs === 0) continue;
        if (mine > 0 === theirs > 0) agree++;
        else disagree++;
      }
    }
    const n = agree + disagree;
    if (n < MIN_NEIGHBOUR_PAIRS) return;
    const tau = (agree - disagree) / n;
    if (tau > 0) out.set(i, (tau * n) / (n + 10));
  });
  return out;
}

/**
 * Everything worth recommending, best first.
 * @param myRanks placed works -> tier rank (0 = S)
 * @param listened every work on my list, placed or not: never recommended
 */
/** Popularity in 0..1: log of Reddit lists and of Audible ratings, each against the most popular work.
 * Also what For You's "combined" popularity slider measures. */
export function popularityOf(index: Index): (w: DataWork) => number {
  const mostLists = Math.max(1, ...index.appearances.values());
  const mostRatings = Math.max(1, ...index.data.works.map((w) => w.ratingCount ?? 0));
  return (w) =>
    (0.5 * Math.log1p(index.appearances.get(w.key) ?? 0)) / Math.log1p(mostLists) +
    (0.5 * Math.log1p(w.ratingCount ?? 0)) / Math.log1p(mostRatings);
}

export function recommend(index: Index, myRanks: Map<string, number>, listened: Set<string>): Scored[] {
  const quality = index.data.quality;
  const weights = neighbourWeights(index, myRanks);
  const haveNeighbours = weights.size > 0;

  // Neighbour score: weighted mean of how high each neighbour placed the work (1 = their top tier)
  const num = new Map<string, number>();
  const den = new Map<string, number>();
  const support = new Map<string, number[]>(); // ranks the neighbours gave it
  for (const [i, w] of weights) {
    const cl = index.lists[i];
    for (const [key, rank] of cl.ranks) {
      const pos = 1 - rank / (cl.tiers - 1);
      num.set(key, (num.get(key) ?? 0) + w * pos);
      den.set(key, (den.get(key) ?? 0) + w);
      if (!support.has(key)) support.set(key, []);
      support.get(key)!.push(rank);
    }
  }
  // Shrink towards 0.5 (a middling placement) with one list's worth of weight
  const neighbour = new Map([...num].map(([k, n]) => [k, (n + 0.25) / (den.get(k)! + 0.5)]));

  const likedAuthors = new Map<string, string[]>();
  const likedNarrators = new Map<string, string[]>();
  for (const [key, rank] of myRanks) {
    const w = index.works.get(key);
    if (rank > 1 || !w) continue;
    for (const a of w.authors.slice(0, 2)) likedAuthors.set(a, [...(likedAuthors.get(a) ?? []), w.title]);
    for (const n of w.narrators.slice(0, 1)) likedNarrators.set(n, [...(likedNarrators.get(n) ?? []), w.title]);
  }

  // Content: the best tag match among my liked works, minus half the best among disliked ones
  const sim = similarityFor(index);
  const tagged = index.tagSets;
  const liked = [...myRanks].filter(([k, r]) => r in LIKE && tagged.has(k)).map(([k, r]) => [k, LIKE[r]] as const);
  const disliked = [...myRanks]
    .filter(([k, r]) => r in DISLIKE && tagged.has(k))
    .map(([k, r]) => [k, DISLIKE[r]] as const);
  const content = new Map<string, { c: number; best: string | null }>();
  for (const key of tagged.keys()) {
    let best: string | null = null;
    let like = 0;
    for (const [k, w] of liked) {
      const s = w * sim.of(key, k);
      if (best === null || s > like) [best, like] = [k, s];
    }
    let dislike = 0;
    for (const [k, w] of disliked) dislike = Math.max(dislike, w * sim.of(key, k));
    content.set(key, { c: like - 0.5 * dislike, best });
  }
  // Centred on the average tagged work, so untagged works (no signal) sit at the average
  let meanContent = 0;
  for (const { c } of content.values()) meanContent += c / content.size;

  const popularity = popularityOf(index);

  const qualityCount = Object.keys(quality).length;
  const recs: (Scored & { pop: number })[] = [];
  for (const w of index.data.works) {
    const key = w.key;
    if (listened.has(key) || !w.core) continue; // mainstream counts for taste, isn't recommended
    const q = quality[key] ?? null;
    const nb = neighbour.get(key) ?? null;
    const authors = w.authors.slice(0, 2).filter((a) => likedAuthors.has(a));
    const narrators = w.narrators.slice(0, 1).filter((n) => likedNarrators.has(n));
    const affinity = 0.5 * Number(authors.length > 0) + 0.25 * Number(narrators.length > 0);
    const ct = content.get(key);
    if (q === null && nb === null && !affinity && !ct) continue;

    // Quality is a log-strength, roughly -2..2; neighbour is 0..1 centred on 0.5; content 0..1
    let score = 0.5 * (q ?? 0) + (haveNeighbours ? 2.0 * ((nb ?? 0.5) - 0.5) : 0) + affinity;
    if (ct && liked.length) score += CONTENT_WEIGHT * (ct.c - meanContent);
    const pop = popularity(w);
    score += POPULARITY_WEIGHT * pop; // centred below, once every candidate is known

    const reasons: string[] = [];
    if (ct?.best && sim.of(key, ct.best) >= 0.5) {
      reasons.push(
        `same kind of story as ${index.works.get(ct.best)?.title ?? ct.best}: ${sim.shared(key, ct.best).join(", ")}`,
      );
    }
    const sup = support.get(key) ?? [];
    if (nb !== null && haveNeighbours) {
      const top = sup.filter((r) => r === 0).length;
      reasons.push(
        `${sup.length} reader${sup.length !== 1 ? "s" : ""} with taste like yours ranked it` +
          (top ? `, ${top} in their top tier` : ""),
      );
    }
    if (q !== null) reasons.push(`#${index.qualityOrder.get(key)} of ${qualityCount} in Reddit tier lists`);
    const lists = index.appearances.get(key) ?? 0;
    if (lists >= 100 || (w.ratingCount ?? 0) >= 5000) {
      reasons.push(`widely read: in ${lists} Reddit tier lists, ${(w.ratingCount ?? 0).toLocaleString("en-GB")} Audible ratings`);
    }
    for (const a of authors) reasons.push(`same author as ${likedAuthors.get(a)!.slice(0, 2).join(", ")}`);
    for (const n of narrators) reasons.push(`narrated by ${n}, like ${likedNarrators.get(n)!.slice(0, 2).join(", ")}`);
    recs.push({ key, score, quality: q, neighbourSupport: sup.length, reasons, pop });
  }
  // Centre popularity on the average candidate
  const meanPop = recs.reduce((s, r) => s + r.pop, 0) / (recs.length || 1);
  for (const r of recs) r.score -= POPULARITY_WEIGHT * meanPop;
  recs.sort((a, b) => b.score - a.score);

  // Audible sometimes has two series entries for one series (re-releases, a second publisher)
  const seen = new Set<string>();
  return recs.filter((r) => {
    const ident = index.works.get(r.key)!.ident;
    if (seen.has(ident)) return false;
    seen.add(ident);
    return true;
  });
}

const PREFER_BONUS = 0.6; // per preferred tag a pick has
const AVOID_PENALTY = 0.8; // per avoided tag a pick has

/** "Prefer, don't require": tags the user leans towards or away from move picks up or down the
 * ranking instead of removing them. Returns a new list, best first, with a reason added to the
 * picks it moved. */
export function applyPreferences<T extends { score: number; reasons: string[] }>(
  recs: T[],
  tagsOf: (rec: T) => Set<string>,
  prefer: string[],
  avoid: string[],
): T[] {
  const label = (t: string) => t.split(":").slice(1).join(":");
  return recs
    .map((r) => {
      const tags = tagsOf(r);
      const liked = prefer.filter((t) => tags.has(t));
      const disliked = avoid.filter((t) => tags.has(t));
      const reasons = [...r.reasons];
      if (disliked.length) reasons.unshift(`has ${disliked.map(label).join(", ")}, which you'd rather avoid`);
      if (liked.length) reasons.unshift(`matches what you prefer: ${liked.map(label).join(", ")}`);
      return { ...r, reasons, score: r.score + PREFER_BONUS * liked.length - AVOID_PENALTY * disliked.length };
    })
    .sort((a, b) => b.score - a.score); // stable: ties keep their order
}
