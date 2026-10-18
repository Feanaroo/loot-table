import { useEffect, useState } from "react";
import { api, type Work } from "../api";

/** Any book in the catalog, not only the ones you ranked: picking one prefers its tags. */
export default function LikeBookSearch({ onPick }: { onPick: (w: Work) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Work[]>([]);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const r = q.trim() ? await api.search(q, 8) : [];
      if (!cancelled) setResults(r);
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="tag-filter-row suggest-row">
      <span className="tag-filter-label">like a book</span>
      <div className="like-search">
        <input
          className="search-input"
          placeholder="Any series, author or narrator…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {results.length > 0 && (
          <div className="like-results">
            {results.map((w) => (
              <button
                key={w.key}
                className="like-item"
                onClick={() => {
                  onPick(w);
                  setQ("");
                  setResults([]);
                }}
              >
                {w.title} <span className="muted small">{w.authors[0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
