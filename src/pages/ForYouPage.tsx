import { useCallback, useEffect, useRef, useState } from "react";
import { api, hours, TIERS, type Recommendations } from "../api";
import { useBoard, useOpenWork } from "../board";
import { Cover, StatusLine, Stars, Tags, TierButtons, type TagFilter } from "../components/common";
import PopularitySlider from "../components/PopularitySlider";
import TagFilterBar from "../components/TagFilterBar";
import { ANY_POPULARITY, isActive, type PopFilter } from "../popularity";

const FILTER_KEY = "foryou.tagFilter";
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

function loadFilter(): TagFilter {
  try {
    return JSON.parse(localStorage.getItem(FILTER_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export default function ForYouPage() {
  const [data, setData] = useState<Recommendations | null>(null);
  const [vocab, setVocab] = useState<Record<string, string[]> | null>(null);
  const [filter, setFilter] = useState<TagFilter>(loadFilter);
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
  // off -> must have -> must not have -> off
  const toggle = (tag: string) => {
    const next = { ...filter };
    if (!next[tag]) next[tag] = "in";
    else if (next[tag] === "in") next[tag] = "out";
    else delete next[tag];
    setWhy([]);
    changeFilter(next);
  };

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="muted">Scoring…</div>;

  // Ranked from this page: hide until the next refresh rather than jumping the grid
  const items = data.items.filter((r) => !bucketOf(r.key));
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
          {ranked >= 5 && (
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
            </div>
          )}
          {Object.keys(filter).length > 0 && (
            <div className="tag-filter-row suggest-row">
              <span className="tag-filter-label">tags</span>
              <label className="small">
                <input type="checkbox" checked={soft} onChange={(e) => changeSoft(e.target.checked)} /> Prefer, don't
                require
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
