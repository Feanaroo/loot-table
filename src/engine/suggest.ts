/** Tag filters worked out from the tier list, so For you doesn't start from a blank filter bar.
 *
 * A tag is worth requiring when most of the series you rank high (S, A) have it and it's clearly
 * more common there than in the genre as a whole; worth excluding when most of the ones you rank
 * low (D, F) have it and the ones you like almost never do. */

import type { Index } from "./data";

/** Same shape as the filter in the UI: "group:tag" -> must have / must not have */
export type SuggestedFilter = Record<string, "in" | "out">;

const LIKED_TIERS = new Set([0, 1]); // S, A
const DISLIKED_TIERS = new Set([4, 5]); // D, F
const MIN_SERIES = 2; // ranked high (or low) before there's a pattern to read
const MIN_SHARE = 0.6; // of those series have the tag
const MIN_LIFT = 1.3; // times as common as across the genre
const MAX_LIKED_SHARE_FOR_OUT = 0.1;
const MAX_IN = 3;
const MAX_OUT = 2;

/** How many of `keys` carry each tag, as a fraction */
function shares(index: Index, keys: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const k of keys) for (const t of index.tagSets.get(k) ?? []) out.set(t, (out.get(t) ?? 0) + 1 / keys.length);
  return out;
}

export function suggestFilter(index: Index, myRanks: Map<string, number>): SuggestedFilter {
  const tagged = (tiers: Set<number>) =>
    [...myRanks].filter(([k, r]) => tiers.has(r) && index.tagSets.has(k)).map(([k]) => k);
  const liked = tagged(LIKED_TIERS);
  const disliked = tagged(DISLIKED_TIERS);

  const genre = shares(
    index,
    index.data.works.filter((w) => w.core && index.tagSets.has(w.key)).map((w) => w.key),
  );
  const likedShare = liked.length >= MIN_SERIES ? shares(index, liked) : new Map<string, number>();
  const dislikedShare = disliked.length >= MIN_SERIES ? shares(index, disliked) : new Map<string, number>();
  const lift = (tag: string, share: number) => share / Math.max(genre.get(tag) ?? 0, 0.01);
  const strongest = (shared: Map<string, number>, ok: (tag: string, share: number) => boolean, n: number) =>
    [...shared]
      .filter(([t, s]) => s >= MIN_SHARE && lift(t, s) >= MIN_LIFT && ok(t, s))
      .sort((a, b) => lift(b[0], b[1]) * b[1] - lift(a[0], a[1]) * a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, n)
      .map(([t]) => t);

  const filter: SuggestedFilter = {};
  for (const t of strongest(likedShare, () => true, MAX_IN)) filter[t] = "in";
  for (const t of strongest(dislikedShare, (t) => (likedShare.get(t) ?? 0) <= MAX_LIKED_SHARE_FOR_OUT, MAX_OUT)) {
    filter[t] = "out";
  }
  return filter;
}
