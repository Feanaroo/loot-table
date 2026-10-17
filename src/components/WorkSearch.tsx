import { useEffect, useState } from "react";
import { api, type Work } from "../api";
import { useOpenWork } from "../board";
import { Cover, TierButtons } from "./common";

/** Catalog search with one-click ranking: the fastest way to fill a tier list from memory. */
export default function WorkSearch({ autoFocus }: { autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Work[]>([]);
  const [loading, setLoading] = useState(false);
  const openWork = useOpenWork();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(async () => {
      const r = await api.search(q);
      if (!cancelled) {
        setResults(r);
        setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="search">
      <input
        className="search-input"
        placeholder="Search series, author or narrator…"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="muted small search-caption">
        {q ? (loading ? "Searching…" : `${results.length} results`) : "Most rated on Audible UK"}
      </div>
      <div className="search-results">
        {results.map((w) => (
          <div key={w.key} className="search-item" onClick={() => openWork(w.key)}>
            <Cover work={w} size={48} />
            <div className="search-text">
              <div className="search-title">{w.title}</div>
              <div className="muted small">
                {w.authors.slice(0, 2).join(", ")} · {w.bookCount} book{w.bookCount !== 1 ? "s" : ""}
              </div>
              <TierButtons work={w} compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
