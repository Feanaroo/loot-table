import type { ReactNode } from "react";
import { FILTER_GROUPS, STATUS_LABELS, type TagFilter } from "./common";

/** Every tag, by group. Click: must have → must not have → off. Counts are the picks that
 * would match with the tag added. */
export default function TagFilterBar({
  vocab,
  counts,
  filter,
  soft = false,
  onToggle,
  onClear,
  extraActive = 0,
  children,
}: {
  vocab: Record<string, string[]>;
  counts: Record<string, number>;
  filter: TagFilter;
  /** Tags prefer / avoid instead of require / exclude */
  soft?: boolean;
  onToggle: (tag: string) => void;
  onClear: () => void;
  /** Filters set outside the tag rows (the popularity slider), for the Clear button */
  extraActive?: number;
  /** Rows above the tags */
  children?: ReactNode;
}) {
  const active = Object.keys(filter).length + extraActive;
  return (
    <div className="tag-filter">
      {children}
      {FILTER_GROUPS.filter((g) => vocab[g]).map((g) => (
        <div key={g} className="tag-filter-row">
          <span className="tag-filter-label">{g}</span>
          <div className="tags">
            {vocab[g].map((t) => {
              const key = `${g}:${t}`;
              const state = filter[key];
              const n = counts[key] ?? 0;
              return (
                <button
                  key={key}
                  className={`tag tag-${g} ${state ? `tag-${state}` : ""} ${!state && !n ? "tag-empty" : ""}`}
                  title={
                    state === "in"
                      ? soft ? "Preferred · click to avoid" : "Must have · click to exclude"
                      : state === "out"
                        ? soft ? "Avoided · click to clear" : "Excluded · click to clear"
                        : soft ? "Click to prefer" : "Click to require"
                  }
                  onClick={() => onToggle(key)}
                >
                  {state === "out" ? "not " : ""}
                  {g === "status" ? STATUS_LABELS[t] ?? t : t}
                  {!state && <span className="tag-count">{n}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {active > 0 && (
        <button className="tag-clear" onClick={onClear}>
          Clear {active} filter{active !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
