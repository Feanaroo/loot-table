/** For You's popularity slider: keep picks between two points of "how well known".
 *
 * The slider's 0..100 are percentiles of the series Reddit has ranked (genre series in at least one
 * tier list), measured one of three ways: Reddit tier lists, Audible ratings, or both combined (the
 * scoring's own popularity). A position stands for that percentile's value, so ties are kept
 * together: at "1 tier list" are all the series in exactly one list.
 *
 * A series with no Audible rating count (54 of them, mostly new or pre-order-only entries, but also
 * Shadow Slave) has an unknown place by ratings: it's left out of those percentiles, and out of the
 * picks while the slider is narrowed by ratings, rather than passed off as obscure. */

import type { DataWork, Index } from "./engine/data";
import { popularityOf } from "./engine/recommend";

export type PopMode = "combined" | "lists" | "ratings";
export const POP_MODES: { id: PopMode; label: string; title: string }[] = [
  { id: "combined", label: "Both", title: "Reddit tier lists and Audible ratings together" },
  { id: "lists", label: "Reddit lists", title: "How many Reddit tier lists rank it" },
  { id: "ratings", label: "Audible ratings", title: "How many ratings it has on Audible UK" },
];

export interface PopFilter {
  mode: PopMode;
  /** Slider positions, 0..100 */
  min: number;
  max: number;
}
export const ANY_POPULARITY: PopFilter = { mode: "combined", min: 0, max: 100 };
export const isActive = (p: PopFilter) => p.min > 0 || p.max < 100;

interface Scale {
  /** null: unknown */
  value: (w: DataWork) => number | null;
  /** Values of the series the percentiles are of, ascending */
  sorted: number[];
}

const cache = new WeakMap<Index, Record<PopMode, Scale>>();

function scales(index: Index): Record<PopMode, Scale> {
  let s = cache.get(index);
  if (!s) {
    const ranked = index.data.works.filter((w) => w.core && (index.appearances.get(w.key) ?? 0) > 0);
    const make = (value: (w: DataWork) => number | null): Scale => ({
      value,
      sorted: ranked
        .map(value)
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b),
    });
    s = {
      combined: make(popularityOf(index)),
      lists: make((w) => index.appearances.get(w.key) ?? 0),
      ratings: make((w) => w.ratingCount || null),
    };
    cache.set(index, s);
  }
  return s;
}

const at = (sorted: number[], position: number) => sorted[Math.round((position / 100) * (sorted.length - 1))];

/** The values the slider's two ends stand for; open-ended at 0 and 100 */
function bounds(index: Index, p: PopFilter) {
  const { sorted } = scales(index)[p.mode];
  return { lo: p.min > 0 ? at(sorted, p.min) : -Infinity, hi: p.max < 100 ? at(sorted, p.max) : Infinity };
}

/** A predicate for works within the slider's range */
export function within(index: Index, p: PopFilter): (w: DataWork) => boolean {
  if (!isActive(p)) return () => true;
  const { value } = scales(index)[p.mode];
  const { lo, hi } = bounds(index, p);
  return (w) => {
    const v = value(w);
    return v !== null && v >= lo && v <= hi;
  };
}

/** What the slider keeps, in words: "in 3–40 Reddit tier lists", "the 30% best known" */
export function describe(index: Index, p: PopFilter): string {
  if (!isActive(p)) return "Any popularity";
  const { lo, hi } = bounds(index, p);
  const n = (v: number) => Math.round(v).toLocaleString("en-GB");
  const range = (unit: string) =>
    p.min === 0 ? `up to ${n(hi)} ${unit}` : p.max === 100 ? `${n(lo)}+ ${unit}` : lo === hi ? `${n(lo)} ${unit}` : `${n(lo)}–${n(hi)} ${unit}`;
  if (p.mode === "lists") return `In ${range(hi === 1 && p.min === 0 ? "Reddit tier list" : "Reddit tier lists")}`;
  if (p.mode === "ratings") return range("Audible ratings").replace(/^./, (c) => c.toUpperCase());
  if (p.min === 0) return `The ${p.max}% least known`;
  if (p.max === 100) return `The ${100 - p.min}% best known`;
  return `Between the ${p.min}th and ${p.max}th percentile of how well known`;
}
