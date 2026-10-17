import { useEffect, useState } from "react";
import { api, hours, type WorkDetail } from "../api";
import { Cover, Stars, Tags, TierButtons } from "./common";

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
                    {b.year} · {hours(b.runtimeMin)}
                    {b.rating ? ` · ★ ${b.rating.toFixed(1)}` : ""}
                  </span>
                </li>
              ))}
            </ol>
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
