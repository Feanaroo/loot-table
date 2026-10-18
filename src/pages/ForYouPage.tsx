import { useCallback, useEffect, useRef, useState } from "react";
import { api, hours, TIERS, type Recommendations, type Work } from "../api";
import { useBoard, useOpenWork } from "../board";
import { Cover, StatusLine, Stars, Tags, TierButtons, type TagFilter } from "../components/common";
import LikeBookSearch from "../components/LikeBookSearch";
import PopularitySlider from "../components/PopularitySlider";
import TagFilterBar from "../components/TagFilterBar";
import { ANY_POPULARITY, isActive, type PopFilter } from "../popularity";
import { FILTER_KEY, flipFilterTag, readFilter, TAG_EVENT } from "../foryouFilter";

const POPULARITY_KEY = "foryou.popularity";
const SOFT_KEY = "foryou.soft";

function loadPopularity(): PopFilter {
  try {
    return { ...ANY_POPULARITY, ...JSON.parse(localStorage.getItem(POPULARITY_KEY) ?? "{}") };
  } catch {
    return ANY_POPULARITY;
  }
}

function loadSoft(): boolean {
  try {
    return localStorage.getItem(SOFT_KEY) === "1";
  } catch {
    return false;
  }
}

export default function ForYouPage() {
  const [data, setData] = useState<Recommendations | null>(null);
  const [vocab, setVocab] = useState<Record<string, string[]> | null>(null);
  const [filter, setFilter] = useState<TagFilter>(readFilter);
  const [popularity, setPopularity] = useState<PopFilter>(loadPopularity);
  const [popularityText, setPopularityText] = useState("");
  // In words as the handle moves, before the picks are rescored
  useEffect(() => {
    let current = true;
    api.describePopularity(popularity).then((t) => current && setPopularityText(t));
    return () => {
      current = false;
    };
  }, [popularity]);
  const [soft, setSoft] = useState(loadSoft);
  const [why, setWhy] = useState<string[]>([]);
  const [filledEmpty, setFilledEmpty] = useState(false);
  const [picks, setPicks] = useState<{ key: string; title: string; tags: string[] }[]>([]);
  // What the filters were before "Fill from my books", so that fill can be taken back
  const [undo, setUndo] = useState<{ filter: TagFilter; popularity: PopFilter; soft: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { board, bucketOf } = useBoard();
  const openWork = useOpenWork();
  const ranked = TIERS.reduce((n, t) => n + board[t].length, 0);
  const request = useRef(0);

  useEffect(() => {
    api.tags().then(setVocab, () => setVocab({}));
  }, []);

  const load = useCallback((f: TagFilter, p: PopFilter, soft: boolean) => {
    const id = ++request.current;
    setLoading(true);
    const pick = (state: "in" | "out") => Object.keys(f).filter((k) => f[k] === state);
    api.recommendations(pick("in"), pick("out"), p, 60, soft).then(
      (d) => {
        // A slow answer to an older filter mustn't replace a newer one
        if (id !== request.current) return;
        setData(d);
        setLoading(false);
      },
      (e) => setError(String(e)),
    );
  }, []);

  // Recompute when the tier list changes, once the board has saved it (it saves after 400 ms);
  // the first time, straight away
  const signature = TIERS.map((t) => board[t].map((w) => w.key).join(",")).join("|");
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const popularityRef = useRef(popularity);
  popularityRef.current = popularity;
  const softRef = useRef(soft);
  softRef.current = soft;
  const first = useRef(true);
  useEffect(() => {
    const t = window.setTimeout(() => load(filterRef.current, popularityRef.current, softRef.current), first.current ? 0 : 700);
    first.current = false;
    return () => window.clearTimeout(t);
  }, [signature, load]);

  const remember = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // private window: the filter just isn't remembered
    }
  };
  const changeFilter = (next: TagFilter, p: PopFilter = popularity, s: boolean = soft) => {
    setFilter(next);
    remember(FILTER_KEY, next);
    load(next, p, s);
  };
  const changeSoft = (s: boolean) => {
    setSoft(s);
    try {
      localStorage.setItem(SOFT_KEY, s ? "1" : "0");
    } catch {
      // private window: the choice just isn't remembered
    }
    load(filter, popularity, s);
  };
  // Dragging fires many changes: score once the handle rests
  const slide = useRef<number>();
  const changePopularity = (p: PopFilter) => {
    setPopularity(p);
    remember(POPULARITY_KEY, p);
    window.clearTimeout(slide.current);
    slide.current = window.setTimeout(() => load(filterRef.current, p, softRef.current), 200);
  };
  const clearAll = () => {
    const p = { ...popularity, min: 0, max: 100 };
    setPopularity(p);
    remember(POPULARITY_KEY, p);
    setWhy([]);
    changeFilter({}, p);
  };
  const fillFromBooks = async () => {
    const s = await api.suggest();
    const empty = Object.keys(s.filter).length === 0 && !s.popularity;
    setFilledEmpty(empty);
    setWhy(empty ? [] : s.reasons);
    if (empty) return;
    setUndo({ filter, popularity, soft });
    const p = s.popularity ?? popularity;
    setPopularity(p);
    remember(POPULARITY_KEY, p);
    // What the books suggest are leanings, not rules: they shouldn't be able to empty the picks
    setSoft(true);
    try {
      localStorage.setItem(SOFT_KEY, "1");
    } catch {
      // private window
    }
    changeFilter(s.filter, p, true);
  };
  const undoFill = () => {
    if (!undo) return;
    setPopularity(undo.popularity);
    remember(POPULARITY_KEY, undo.popularity);
    setSoft(undo.soft);
    try {
      localStorage.setItem(SOFT_KEY, undo.soft ? "1" : "0");
    } catch {
      // private window
    }
    setWhy([]);
    setUndo(null);
    changeFilter(undo.filter, undo.popularity, undo.soft);
  };
  // A book you haven't ranked: its tags become preferences, like the books you ranked do
  const likeBook = async (w: Work) => {
    const d = await api.work(w.key);
    const tags = Object.entries(d.tags ?? {}).flatMap(([g, ts]) => ts.map((t) => `${g}:${t}`));
    // The book you picked is one you already know: it's kept out of the picks
    setPicks((p) => (p.some((x) => x.key === w.key) ? p : [...p, { key: w.key, title: w.title, tags }]));
    if (tags.length === 0) {
      setWhy([`${w.title} has no tags yet, so there's nothing to filter by.`]);
      return;
    }
    const next = { ...filter };
    for (const t of tags) if (!next[t]) next[t] = "in";
    setWhy([`Likes ${w.title}: ${tags.map((t) => t.split(":").slice(1).join(":")).join(", ")}.`]);
    setSoft(true);
    try {
      localStorage.setItem(SOFT_KEY, "1");
    } catch {
      // private window
    }
    changeFilter(next, popularity, true);
  };
  // Removes the book and the tags only it added; tags another pick also has stay
  const unlikeBook = (key: string) => {
    const gone = picks.find((p) => p.key === key);
    const rest = picks.filter((p) => p.key !== key);
    setPicks(rest);
    if (!gone) return;
    const kept = new Set(rest.flatMap((p) => p.tags));
    const next = { ...filter };
    for (const t of gone.tags) if (next[t] === "in" && !kept.has(t)) delete next[t];
    setWhy([]);
    changeFilter(next);
  };
  // off -> must have -> must not have -> off
  const toggle = (tag: string) => {
    const next = { ...filter };
    if (!next[tag]) next[tag] = "in";
    else if (next[tag] === "in") next[tag] = "out";
    else delete next[tag];
    setWhy([]);
    changeFilter(next);
  };
  // A tag clicked in the book drawer: add it, or remove it if it's already there
  const flipRef = useRef<(tag: string) => void>(() => {});
  flipRef.current = (tag: string) => {
    setWhy([]);
    changeFilter(flipFilterTag(filterRef.current, tag));
  };
  useEffect(() => {
    const onTag = (e: Event) => flipRef.current((e as CustomEvent<string>).detail);
    window.addEventListener(TAG_EVENT, onTag);
    return () => window.removeEventListener(TAG_EVENT, onTag);
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="muted">Scoring…</div>;

  // Ranked from this page: hide until the next refresh rather than jumping the grid
  const picked = new Set(picks.map((p) => p.key));
  const items = data.items.filter((r) => !bucketOf(r.key) && !picked.has(r.key));
  const filtered = (!soft && Object.keys(filter).length > 0) || isActive(popularity);

  return (
    <div>
      <div className="page-head">
        <h1>For you</h1>
        <span className="muted">
          {ranked < 5
            ? "Rank at least 5 series to get personal picks — until then this is the community's favourites."
            : `Based on your ${ranked} ranked series, ${data.neighbours} Reddit readers with similar taste, and ${data.communityLists} tier lists.`}
        </span>
      </div>
      {data.communityLists === 0 && (
        <div className="notice">
          No Reddit tier lists are parsed yet, so there's nothing to score with. Run <code>audiorecs tierlists</code>.
        </div>
      )}
      {vocab && Object.keys(vocab).length > 0 && (
        <TagFilterBar
          vocab={vocab}
          counts={data.tagCounts}
          filter={filter}
          soft={soft}
          onToggle={toggle}
          onClear={clearAll}
          extraActive={Number(isActive(popularity))}
        >
          {ranked >= 1 && (
            <div className="tag-filter-row suggest-row">
              <span className="tag-filter-label">from you</span>
              <button className="tag-suggest" onClick={fillFromBooks}>
                Fill from my books
              </button>
              <span className="muted small">
                {filledEmpty
                  ? "No clear pattern yet: rank a few more series in your top and bottom tiers."
                  : "Sets the filters from what your S and A tiers have in common, and what your D and F tiers do."}
              </span>
              {undo && (
                <button className="tag-suggest" onClick={undoFill}>
                  Undo fill
                </button>
              )}
            </div>
          )}
          <LikeBookSearch onPick={likeBook} />
          {picks.length > 0 && (
            <div className="tag-filter-row suggest-row">
              <span className="tag-filter-label">picked</span>
              <div className="tags">
                {picks.map((p) => (
                  <button key={p.key} className="tag tag-in" title="Remove this book and the tags only it added" onClick={() => unlikeBook(p.key)}>
                    {p.title} ×
                  </button>
                ))}
              </div>
            </div>
          )}
          {Object.keys(filter).length > 0 && (
            <div className="tag-filter-row suggest-row">
              <span className="tag-filter-label">tags</span>
              <label className="small">
                <input type="checkbox" checked={soft} onChange={(e) => changeSoft(e.target.checked)} /> Show all, matches
                first
              </label>
              <span className="muted small">
                {soft
                  ? "Picks with your tags rank higher, picks with the ones you avoid rank lower; nothing is hidden."
                  : "Only picks that pass every tag are shown."}
              </span>
            </div>
          )}
          {why.length > 0 && (
            <ul className="suggest-why muted small">
              {why.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          <PopularitySlider value={popularity} summary={popularityText || data.popularity} onChange={changePopularity} />
        </TagFilterBar>
      )}
      {filtered && (
        <div className="muted small filter-summary">
          {data.matching.toLocaleString()} pick{data.matching !== 1 ? "s" : ""} match
          {data.matching > data.items.length ? `, showing the top ${data.items.length}` : ""}
        </div>
      )}
      {filtered && data.matching === 0 && (
        <div className="notice">Nothing matches all of these filters. Remove one to widen the search.</div>
      )}
      <div className={`rec-grid ${loading ? "stale" : ""}`}>
        {items.map((r, i) => (
          <article key={r.key} className="rec" onClick={() => openWork(r.key)}>
            <div className="rec-rank">{i + 1}</div>
            <Cover work={r} size={110} />
            <div className="rec-body">
              <h3>{r.title}</h3>
              <div className="small">{r.authors.slice(0, 2).join(", ")}</div>
              <div className="muted small">
                {r.narrators[0] && `🎙 ${r.narrators[0]} · `}
                {r.bookCount} book{r.bookCount !== 1 ? "s" : ""} · {hours(r.runtimeMin)}
              </div>
              <StatusLine status={r.status} />
              <Stars rating={r.rating} count={r.ratingCount} />
              <Tags tags={r.tags} filter={filter} onToggle={toggle} />
              <ul className="reasons">
                {r.reasons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <div className="rec-actions">
                <span className="muted small">Already heard it?</span>
                <TierButtons work={r} compact />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
