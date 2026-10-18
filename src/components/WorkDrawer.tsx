import { useEffect, useState, type MouseEvent } from "react";
import { api, hours, type WorkDetail } from "../api";
import { Cover, StatusLine, Stars, Tags, TierButtons, type TagFilter } from "./common";
import { useBoard } from "../board";
import { flipFilterTag, readFilter, TAG_EVENT, writeFilter } from "../foryouFilter";

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
  const levels = [0, 1, 2, 3, 4, 5]
    .map((l) => {
      const labels = new Map<string, { label: string; count: number }>();
      let total = 0;
      for (const c of placements) {
        if (levelOf(c) !== l) continue;
        total++;
        const label = c.label.trim().replace(/\s+/g, " ") || `#${c.rank + 1}`;
        const key = label.toLowerCase();
        const g = labels.get(key) ?? { label, count: 0 };
        g.count++;
        labels.set(key, g);
      }
      const sorted = [...labels.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
      return { level: l, total, labels: sorted };
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

/** Audible ratings are out of 5; the colour steps show where a book sits */
const ratingLevel = (r: number | null) => (r === null ? "none" : r >= 4.8 ? "top" : r >= 4.6 ? "high" : r >= 4.4 ? "mid" : "low");

/** One book as a tile in the ratings grid: its place in the series, and its rating */
function RatingTile({ b }: { b: Book }) {
  return (
    <a
      className={`rating-tile r-${ratingLevel(b.rating)}`}
      href={`https://www.audible.co.uk/pd/${b.asin}`}
      target="_blank"
      rel="noreferrer"
      title={`${b.title}${b.rating ? ` · ★ ${b.rating.toFixed(1)}` : ""}`}
    >
      <span className="rating-seq">{b.sequence ? `Book ${b.sequence}` : ""}</span>
      <span className="rating-year">{b.year ?? ""}</span>
      <b>{b.rating ? b.rating.toFixed(1) : "–"}</b>
    </a>
  );
}

const RATING_LEGEND: [string, string][] = [
  ["top", "4.8 and up"],
  ["high", "4.6 to 4.7"],
  ["mid", "4.4 to 4.5"],
  ["low", "under 4.4"],
  ["none", "no rating"],
];

const when = (b: Book) => [b.year, hours(b.runtimeMin)].filter(Boolean).join(" · ") || "not out yet";
const BookLink = ({ b }: { b: Book }) => (
  <a href={`https://www.audible.co.uk/pd/${b.asin}`} target="_blank" rel="noreferrer">
    {b.title}
  </a>
);

const BookRating = ({ b }: { b: Book }) => (
  <span className="muted small book-rating">{b.rating ? `★ ${b.rating.toFixed(1)}` : ""}</span>
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
        <BookRating b={first} />
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

const HEADER_KEY = "drawer.header";

const narrators = (work: WorkDetail) => work.narrators.slice(0, 3).join(", ") || "?";
const ratings = (work: WorkDetail) => (work.ratingCount ? `${work.ratingCount.toLocaleString()} ratings` : "no ratings yet");
const bookCount = (work: WorkDetail) => `${work.bookCount} book${work.bookCount !== 1 ? "s" : ""}`;

/** Heading for your list, with a symbol saying whether the book is on it. Hover shows what the
 * symbol means; tapping it shows the words under the heading, for touch screens. */
function YourList({ work }: { work: WorkDetail }) {
  const { bucketOf } = useBoard();
  const [open, setOpen] = useState(false);
  const bucket = bucketOf(work.key);
  const kind = !bucket ? "none" : bucket === "unplaced" ? "unplaced" : "ranked";
  const symbol = { none: "○", unplaced: "🎧", ranked: "✓" }[kind];
  const text = {
    none: "Not on your list yet",
    unplaced: "Listened to, not ranked yet",
    ranked: `On your tier list: ${bucket}`,
  }[kind];
  return (
    <div className="your-list">
      <div className="section-head">
        <h3>Your tier</h3>
        <span className="tier-info">
          <button
            type="button"
            className={`list-status ${kind}`}
            aria-label={text}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            onBlur={() => setOpen(false)}
          >
            {symbol}
          </button>
          <span role="tooltip" className={`tier-pop ${open ? "open" : ""}`}>
            {text}
          </span>
        </span>
      </div>
    </div>
  );
}

/** Big header: the cover over a blurred copy of itself, the numbers in a row */
function HeroHeader({ work }: { work: WorkDetail }) {
  return (
    <div className="hero">
      <div className="hero-backdrop" style={work.image ? { backgroundImage: `url(${work.image})` } : undefined} />
      <div className="hero-body">
        <div className="hero-top">
          <Cover work={work} size={96} />
          <div>
            <h2>{work.title}</h2>
            <a className="audible-link hero-audible" href={work.audibleUrl} target="_blank" rel="noreferrer">
              Open book 1 on Audible ↗
            </a>
            <div>{work.authors.join(", ")}</div>
            <StatusLine status={work.status} />
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <b className="stars-num">{work.rating ? work.rating.toFixed(1) : "–"}</b>
            <span>{ratings(work)}</span>
          </div>
          <div>
            <b>{work.bookCount}</b>
            <span>{work.bookCount !== 1 ? "books" : "book"}</span>
          </div>
          <div>
            <b>{hours(work.runtimeMin)}</b>
            <span>listening</span>
          </div>
        </div>
        <div className="muted small">Narrated by {narrators(work)}</div>
        <YourList work={work} />
        <TierButtons work={work} />
      </div>
    </div>
  );
}

/** Small header: the facts on one line, the tiers under */
function CompactHeader({ work }: { work: WorkDetail }) {
  return (
    <div className="compact-header">
      <Cover work={work} size={64} />
      <div>
        <h2>{work.title}</h2>
        <div className="muted small">
          {work.authors.join(", ")} · {narrators(work)}
        </div>
      </div>
      <div className="small meta compact-facts">
        <Stars rating={work.rating} count={work.ratingCount} />
        <span className="muted">
          {bookCount(work)} · {hours(work.runtimeMin)}
        </span>
      </div>
      <div className="compact-wide">
        <TierButtons work={work} />
        <a className="audible-link" href={work.audibleUrl} target="_blank" rel="noreferrer">
          Open book 1 on Audible ↗
        </a>
      </div>
    </div>
  );
}

export default function WorkDrawer({ workKey, onClose }: { workKey: string | null; onClose: () => void }) {
  const [work, setWork] = useState<WorkDetail | null>(null);
  const [allBooks, setAllBooks] = useState(false);
  const [booksView, setBooksView] = useState<"list" | "ratings">("list");
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem(HEADER_KEY) === "compact";
    } catch {
      return false;
    }
  });
  const chooseHeader = (c: boolean) => {
    setCompact(c);
    try {
      localStorage.setItem(HEADER_KEY, c ? "compact" : "hero");
    } catch {
      // private window: the choice just isn't remembered
    }
  };
  // The For you filter, shown on the tags so they read as on or off
  const [forYou, setForYou] = useState<TagFilter>(readFilter);
  // On For you already: change its filter in place. Elsewhere: set the filter, then go there
  const onTag = (tag: string) => {
    if (window.location.hash === "#/foryou") {
      window.dispatchEvent(new CustomEvent(TAG_EVENT, { detail: tag }));
      setForYou(readFilter());
      return;
    }
    writeFilter(flipFilterTag(readFilter(), tag));
    onClose();
    window.location.hash = "#/foryou";
  };

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
            <div className="header-switch" role="group" aria-label="Header layout">
              {[false, true].map((c) => (
                <button key={String(c)} type="button" className={compact === c ? "on" : ""} onClick={() => chooseHeader(c)}>
                  {c ? "Compact" : "Hero"}
                </button>
              ))}
            </div>
            {compact ? <CompactHeader work={work} /> : <HeroHeader work={work} />}
            {Object.values(work.tags ?? {}).some((t) => t.length > 0) && <h3>Tags</h3>}
            <Tags tags={work.tags} filter={forYou} onToggle={onTag} />
            <div className="section-head">
              <h3>Books</h3>
              <div className="books-switch" role="group" aria-label="Books layout">
                {(["list", "ratings"] as const).map((v) => (
                  <button key={v} type="button" className={booksView === v ? "on" : ""} onClick={() => setBooksView(v)}>
                    {v === "list" ? "List" : "Ratings"}
                  </button>
                ))}
              </div>
            </div>
            {booksView === "ratings" ? (
              <>
                <div className="rating-grid">
                  {work.books.map((b) => (
                    <RatingTile key={b.asin} b={b} />
                  ))}
                </div>
                <div className="rating-legend muted small">
                  {RATING_LEGEND.map(([level, text]) => (
                    <span key={level}>
                      <i className={`swatch r-${level}`} />
                      {text}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <>
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
                          <BookRating b={group[0]} />
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
                  <button type="button" className="books-less" onClick={() => setAllBooks(false)}>
                    Show fewer
                  </button>
                )}
              </>
            )}
            {work.community.length > 0 && <CommunityPlacements placements={work.community} />}
          </>
        )}
      </aside>
    </>
  );
}
