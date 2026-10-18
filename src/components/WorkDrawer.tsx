import { useEffect, useState, type MouseEvent } from "react";
import { api, hours, type WorkDetail } from "../api";
import { Cover, StatusLine, Stars, Tags, TierButtons } from "./common";

/** 0 = their top tier .. 5 = their bottom tier, whatever their tiers are called */
const levelOf = (c: { rank: number; tiers: number }) => (c.tiers > 1 ? Math.round((c.rank / (c.tiers - 1)) * 5) : 0);
const LEVEL_NAMES = ["Top", "2nd", "3rd", "4th", "5th", "Bottom"];
const BOOKS_SHOWN = 10;

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

type Book = WorkDetail["books"][number];

/** Books that share a place in the series (an original and its dramatized parts) fold under one row */
function groupBooks(books: Book[]): Book[][] {
  const groups = new Map<string, Book[]>();
  for (const b of books) {
    const key = b.sequence || b.asin;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  return [...groups.values()];
}

const when = (b: Book) => [b.year, hours(b.runtimeMin)].filter(Boolean).join(" · ") || "not out yet";
const BookLink = ({ b }: { b: Book }) => (
  <a href={`https://www.audible.co.uk/pd/${b.asin}`} target="_blank" rel="noreferrer">
    {b.title}
  </a>
);

function BookGroup({ books }: { books: Book[] }) {
  const [open, setOpen] = useState(false);
  const first = books[0];
  return (
    <li className="book-group">
      {/* The whole row opens the versions; the title still links to Audible */}
      <div
        className="book-head book-toggle"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <span className="seq">{first.sequence}</span>
        <span>
          <span onClick={(e) => e.stopPropagation()}>
            <BookLink b={first} />
          </span>{" "}
          <span className="book-count">
            {books.length} versions {open ? "▴" : "▾"}
          </span>
        </span>
        <span className="muted small">{when(first)}</span>
        <span className="muted small book-rating">{first.rating ? `★ ${first.rating.toFixed(1)}` : ""}</span>
      </div>
      {open && (
        <ul className="book-versions">
          {books.map((b) => (
            <li key={b.asin} className="book-version">
              <BookLink b={b} />
              <span className="muted small">{when(b)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function WorkDrawer({ workKey, onClose }: { workKey: string | null; onClose: () => void }) {
  const [work, setWork] = useState<WorkDetail | null>(null);
  const [allBooks, setAllBooks] = useState(false);

  useEffect(() => {
    setWork(null);
    setAllBooks(false);
    if (workKey) api.work(workKey).then(setWork);
  }, [workKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = work ? groupBooks(work.books) : [];
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
            <div className={`books-fold ${allBooks || rows.length <= BOOKS_SHOWN ? "" : "folded"}`}>
            <ol className="books">
              {rows.map((group) =>
                group.length > 1 ? (
                  <BookGroup key={group[0].asin} books={group} />
                ) : (
                  <li key={group[0].asin} className="book-head">
                    <span className="seq">{group[0].sequence}</span>
                    <BookLink b={group[0]} />
                    <span className="muted small">{when(group[0])}</span>
                    {/* Its own column, so rows without a rating keep the stats lined up */}
                    <span className="muted small book-rating">{group[0].rating ? `★ ${group[0].rating.toFixed(1)}` : ""}</span>
                  </li>
                ),
              )}
            </ol>
            {!allBooks && rows.length > BOOKS_SHOWN && (
              <button type="button" className="books-more" onClick={() => setAllBooks(true)}>
                {rows.length - BOOKS_SHOWN} more · Show all
              </button>
            )}
            </div>
            {allBooks && rows.length > BOOKS_SHOWN && (
              <button type="button" className="tag-suggest" onClick={() => setAllBooks(false)}>
                Show fewer
              </button>
            )}
            {work.community.length > 0 && <CommunityPlacements placements={work.community} />}
          </>
        )}
      </aside>
    </>
  );
}
