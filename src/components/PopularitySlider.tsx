import { POP_MODES, type PopFilter } from "../popularity";

/** Two handles on one track: keep picks between "least known" and "best known", measured by
 * Reddit tier lists, Audible ratings, or both. */
export default function PopularitySlider({
  value,
  summary,
  onChange,
}: {
  value: PopFilter;
  /** What the range keeps, in words (from the last answer) */
  summary: string;
  onChange: (p: PopFilter) => void;
}) {
  const GAP = 5; // the handles can't cross
  const left = `${value.min}%`;
  const width = `${value.max - value.min}%`;
  return (
    <div className="tag-filter-row popularity-row">
      <span className="tag-filter-label">popularity</span>
      <div className="popularity">
        <div className="pop-modes" role="radiogroup" aria-label="Measure popularity by">
          {POP_MODES.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={value.mode === m.id}
              className={`tag ${value.mode === m.id ? "tag-in" : ""}`}
              title={m.title}
              onClick={() => onChange({ ...value, mode: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="pop-slider">
          <span className="pop-end muted small">niche</span>
          <div className="pop-track">
            <div className="pop-fill" style={{ left, width }} />
            <input
              type="range"
              min={0}
              max={100}
              value={value.min}
              aria-label="Least popular to keep"
              onChange={(e) => onChange({ ...value, min: Math.min(Number(e.target.value), value.max - GAP) })}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={value.max}
              aria-label="Most popular to keep"
              onChange={(e) => onChange({ ...value, max: Math.max(Number(e.target.value), value.min + GAP) })}
            />
          </div>
          <span className="pop-end muted small">popular</span>
        </div>
        <span className={`pop-summary small ${value.min > 0 || value.max < 100 ? "" : "muted"}`}>{summary}</span>
      </div>
    </div>
  );
}
