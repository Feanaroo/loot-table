import { TIERS, type Bucket, type StoryTags, type Work } from "../api";
import { useBoard } from "../board";

export function Cover({ work, size = 72 }: { work: Pick<Work, "image" | "title">; size?: number }) {
  if (work.image) {
    return (
      <img className="cover" src={work.image} alt={work.title} width={size} height={size} loading="lazy" draggable={false} />
    );
  }
  const initials = work.title
    .split(/\s+/)
    .slice(0, 3)
    .map((w) => w[0])
    .join("");
  return (
    <div className="cover cover-fallback" style={{ width: size, height: size }}>
      {initials}
    </div>
  );
}

/** S A B C D F buttons: rank a work in one click. The current tier is highlighted. */
export function TierButtons({ work, compact }: { work: Work; compact?: boolean }) {
  const { place, remove, bucketOf } = useBoard();
  const current = bucketOf(work.key);
  return (
    <div className={`tier-buttons ${compact ? "compact" : ""}`}>
      {TIERS.map((t) => (
        <button
          key={t}
          className={`tier-btn tier-${t} ${current === t ? "active" : ""}`}
          title={current === t ? "Remove from tier list" : `Put in ${t} tier`}
          onClick={(e) => {
            e.stopPropagation();
            current === t ? remove(work.key) : place(work, t);
          }}
        >
          {t}
        </button>
      ))}
      <button
        className={`tier-btn tier-unplaced ${current === "unplaced" ? "active" : ""}`}
        title="Listened, rank later"
        onClick={(e) => {
          e.stopPropagation();
          current === "unplaced" ? remove(work.key) : place(work, "unplaced" as Bucket);
        }}
      >
        ✓
      </button>
    </div>
  );
}

export function Stars({ rating, count }: { rating: number | null; count: number | null }) {
  if (!rating) return null;
  return (
    <span className="stars" title={`${rating.toFixed(2)} from ${count?.toLocaleString()} Audible ratings`}>
      ★ {rating.toFixed(1)} <span className="muted">({count?.toLocaleString()})</span>
    </span>
  );
}

export const TAG_GROUPS = ["setting", "story", "lead", "tone"];

/** A tag filter: "in" = must have, "out" = must not have; keyed "group:tag" */
export type TagFilter = Record<string, "in" | "out">;

/** Story tags as chips, coloured by group (setting, story, lead, tone). With onToggle they're
 * buttons that add the tag to a filter. */
export function Tags({
  tags,
  filter,
  onToggle,
}: {
  tags: StoryTags;
  filter?: TagFilter;
  onToggle?: (tag: string) => void;
}) {
  if (!tags) return null;
  const chips = TAG_GROUPS.flatMap((g) => (tags[g] ?? []).map((t) => [g, t] as const));
  if (!chips.length) return null;
  return (
    <div className="tags">
      {chips.map(([g, t]) => {
        const state = filter?.[`${g}:${t}`];
        const cls = `tag tag-${g} ${state ? `tag-${state}` : ""}`;
        return onToggle ? (
          <button
            key={g + t}
            className={cls}
            title={`${g} · click to filter`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(`${g}:${t}`);
            }}
          >
            {t}
          </button>
        ) : (
          <span key={g + t} className={cls} title={g}>
            {t}
          </span>
        );
      })}
    </div>
  );
}
