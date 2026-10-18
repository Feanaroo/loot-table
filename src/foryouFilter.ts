import type { TagFilter } from "./components/common";

/** The For you tag filter, kept in local storage so it's there when For you opens */
export const FILTER_KEY = "foryou.tagFilter";
/** Sent on window when a tag is clicked elsewhere while For you is already showing */
export const TAG_EVENT = "foryou:tag";

export function readFilter(): TagFilter {
  try {
    return JSON.parse(localStorage.getItem(FILTER_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function writeFilter(filter: TagFilter) {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
  } catch {
    // private window: the filter just isn't remembered
  }
}

/** Adds the tag as required, or removes it when it's already in the filter */
export function flipFilterTag(filter: TagFilter, tag: string): TagFilter {
  const next = { ...filter };
  if (next[tag]) delete next[tag];
  else next[tag] = "in";
  return next;
}
