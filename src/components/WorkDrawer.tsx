import { useEffect, useState, type MouseEvent } from "react";
import { api, hours, type WorkDetail } from "../api";
import { Cover, StatusLine, Stars, Tags, TierButtons } from "./common";

/** 0 = their top tier .. 5 = their bottom tier, whatever their tiers are called */
const levelOf = (c: { rank: number; tiers: number }) => (c.tiers > 1 ? Math.round((c.rank / (c.tiers - 1)) * 5) : 0);
const LEVEL_NAMES = ["Top", "2nd", "3rd", "4th", "5th", "Bottom"];

/** Readers name their tiers themselves, so the same placement often comes back as many labels.
 * The bar shows where placements fall; pick a part of it to see the labels readers used there. */
function CommunityPlacements({ placements }: { placements: WorkDetail["community"] }) {
  const [picked, setPicked] = useState<Set<number>>(new Set([0]));
  // Hovering a label below lights its stripe up; the id is "level:label"
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const perLevel = [0, 1, 2, 3, 4, 5].map((l) => placements.filter((c) => levelOf(c) === l).length);

  const levels = [0, 1, 2, 3, 4, 5]
    .map((l) => {
      const labels = new Map<string, { label: string; count: number }>();
      for (const c of placements) {
        if (levelOf(c) !== l) continue;
        const label = c.label.trim().replace(/\s+/g, " ") || `#${c.rank + 1}`;
        const key = label.toLowerCase();
        const g = labels.get(key) ?? { label, count: 0 };
        g.count++;
        labels.set(key, g);
      }
      const sorted = [...labels.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
      return { level: l, total: perLevel[l], labels: sorted };
    })
    .filter((l) => l.total > 0);

  // A plain click shows one level; Shift or Ctrl adds or removes levels to compare them
  const pickLevel = (e: MouseEvent, l: number) => {
    if (!(e.shiftKey || e.ctrlKey || e.metaKey)) {
      setPicked(new Set([l]));
      return;
    }
    e.preventDefault(); // keeps a Shift-click from selecting text
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(l)) next.delete(l);
      else next.add(l);
      return next;
    });
  };
  const shown = levels.filter((l) => picked.has(l.level));

  return (
    <>
      <h3>In Reddit tier lists ({placements.length})</h3>
      <div className="seg-bar">
        {levels.map((l) => (
          <button
            key={l.level}
            type="button"
            className={`rank-${l.level} ${picked.has(l.level) ? "on" : ""}`}
            style={{ flexGrow: l.total }}
            aria-pressed={picked.has(l.level)}
            title={`${LEVEL_NAMES[l.level]}: ${l.total} placed. Shift- or Ctrl-click to compare`}
            onClick={(e) => pickLevel(e, l.level)}
          >
            {/* Each label is a stripe, so the segment shows what readers used */}
            <span className="seg-stripes">
              {l.labels.map((r) => (
                <span
                  key={r.label}
                  style={{ flexGrow: r.count }}
                  className={hoverLabel === `${l.level}:${r.label}` ? "hot" : ""}
                />
              ))}
            </span>
            <span className="seg-count">{l.total}</span>
          </button>
        ))}
      </div>
      <div className="level-legend muted small">
        <span>Top of their list</span>
        <span>Shift-click to show several levels</span>
        <span>Bottom</span>
      </div>
      <div className="level-panel">
        {shown.length === 0 && <div className="muted small">Pick a segment to see its labels.</div>}
        {shown.map((l) => (
          <div key={l.level} className="level-group">
            <div className="muted small">
              {LEVEL_NAMES[l.level]} · {l.total} placed
            </div>
            <div className="community-chips">
              {l.labels.map((r) => (
                <span
                  key={r.label}
                  className={`chip rank-${l.level}`}
                  onMouseEnter={() => setHoverLabel(`${l.level}:${r.label}`)}
                  onMouseLeave={() => setHoverLabel(null)}
                >
                  {r.label} <span className="chip-count">×{r.count}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function WorkDrawer({ workKey, onClose }: { workKey: string | null; onClose: () => void }) {
  const [work, setWork] = useState<WorkDetail | null>(null);

  useEffect(() => {
    setWork(null);
    if (workKey) api.work(workKey).then(setWork);
  }, [workKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!workKey) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {!work ? (
          <div className="muted">Loading…</div>
        ) : (
          <>
            <div className="drawer-head">
              <Cover work={work} size={140} />
              <div>
                <h2>{work.title}</h2>
                <div>{work.authors.join(", ")}</div>
                <div className="muted small">Narrated by {work.narrators.slice(0, 3).join(", ") || "?"}</div>
                <div className="small meta">
                  <Stars rating={work.rating} count={work.ratingCount} />
                  <span>
                    {work.bookCount} book{work.bookCount !== 1 ? "s" : ""} · {hours(work.runtimeMin)}
                  </span>
                </div>
                <StatusLine status={work.status} />
                <TierButtons work={work} />
                <a className="audible-link" href={work.audibleUrl} target="_blank" rel="noreferrer">
                  Open book 1 on Audible ↗
                </a>
              </div>
            </div>
            <Tags tags={work.tags} />
            <h3>Books</h3>
            <ol className="books">
              {work.books.map((b) => (
                <li key={b.asin}>
                  <a href={`https://www.audible.co.uk/pd/${b.asin}`} target="_blank" rel="noreferrer">
                    {b.sequence && <span className="seq">{b.sequence}</span>}
                    {b.title}
                  </a>
                  <span className="muted small">
                    {/* A pre-order has no year (Audible's placeholder date is dropped), length or rating */}
                    {[b.year, hours(b.runtimeMin), b.rating ? `★ ${b.rating.toFixed(1)}` : ""].filter(Boolean).join(" · ") ||
                      "not out yet"}
                  </span>
                </li>
              ))}
            </ol>
            {work.community.length > 0 && <CommunityPlacements placements={work.community} />}
          </>
        )}
      </aside>
    </>
  );
}
