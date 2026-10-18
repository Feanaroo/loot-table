import { useEffect, useState } from "react";
import { api, hours, type WorkDetail } from "../api";
import { Cover, StatusLine, Stars, Tags, TierButtons } from "./common";

const BOOKS_SHOWN = 10;

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

// A pre-order has no year (Audible's placeholder date is dropped), length or rating
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
            {work.community.length > 0 && (
              <>
                <h3>In Reddit tier lists ({work.community.length})</h3>
                <p className="muted small">Where readers placed it, best first. Colour = how high in their own list.</p>
                <div className="community-chips">
                  {work.community.map((c, i) => {
                    // 0 = their top tier .. 5 = their bottom tier, whatever their tiers are called
                    const level = c.tiers > 1 ? Math.round((c.rank / (c.tiers - 1)) * 5) : 0;
                    return (
                      <span key={i} className={`chip rank-${level}`} title={`Tier ${c.rank + 1} of ${c.tiers}`}>
                        {c.label || `#${c.rank + 1}`}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </aside>
    </>
  );
}
