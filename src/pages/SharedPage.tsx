import { useEffect, useState } from "react";
import { api, TIERS, type Board, type Bucket, type Tier, type Work } from "../api";
import { useBoard, useOpenWork } from "../board";
import { Cover } from "../components/common";
import { combine } from "../transfer";

type Shared = NonNullable<Awaited<ReturnType<typeof api.readShared>>>;
const BUCKETS: Bucket[] = [...TIERS, "unplaced"];

function Tiles({ works }: { works: Work[] }) {
  const openWork = useOpenWork();
  return (
    <>
      {works.map((w) => (
        <div key={w.key} className="tile" title={`${w.title} — ${w.authors.join(", ")}`} onClick={() => openWork(w.key)}>
          <Cover work={w} />
          <span className="tile-title">{w.title}</span>
        </div>
      ))}
    </>
  );
}

/** Where the two lists agree and differ: series both ranked, and theirs I haven't heard */
function Compare({ shared, mine }: { shared: Shared; mine: Board }) {
  const myTier = new Map<string, Bucket>();
  for (const b of BUCKETS) for (const w of mine[b]) myTier.set(w.key, b);
  const theirs = TIERS.flatMap((t) => shared.board[t].map((w) => ({ w, t })));
  const both = theirs
    .filter(({ w }) => myTier.has(w.key) && myTier.get(w.key) !== "unplaced")
    .map(({ w, t }) => ({ w, them: t, me: myTier.get(w.key) as Tier }))
    .map((x) => ({ ...x, gap: Math.abs(TIERS.indexOf(x.them) - TIERS.indexOf(x.me)) }))
    .sort((a, b) => b.gap - a.gap);
  const fresh = theirs.filter(({ w }) => !myTier.has(w.key)).map(({ w }) => w);
  const close = both.filter((x) => x.gap <= 1).length;
  const openWork = useOpenWork();

  return (
    <section className="compare">
      <h2>Compared with your list</h2>
      {both.length === 0 ? (
        <p className="muted">You haven't ranked any of the same series yet.</p>
      ) : (
        <>
          <p className="muted">
            You both ranked {both.length} series, and agree within a tier on {close} of them.
          </p>
          <table className="compare-table">
            <thead>
              <tr>
                <th>Series</th>
                <th>Them</th>
                <th>You</th>
              </tr>
            </thead>
            <tbody>
              {both.map(({ w, them, me, gap }) => (
                <tr key={w.key} className={gap >= 2 ? "disagree" : ""} onClick={() => openWork(w.key)}>
                  <td>{w.title}</td>
                  <td>
                    <span className={`tier-chip tier-${them}`}>{them}</span>
                  </td>
                  <td>
                    <span className={`tier-chip tier-${me}`}>{me}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {fresh.length > 0 && (
        <>
          <h3>On their list, not on yours ({fresh.length})</h3>
          <div className="tier-items">
            <Tiles works={fresh} />
          </div>
        </>
      )}
    </section>
  );
}

/** A tier list someone shared as a link (#s=...): read-only, with copying it and comparing it to mine. */
export default function SharedPage({ fragment }: { fragment: string }) {
  const { board: mine, reload } = useBoard();
  const [shared, setShared] = useState<Shared | null | undefined>(undefined);
  const [comparing, setComparing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setDone(null);
    api.readShared(fragment).then(setShared, () => setShared(null));
  }, [fragment]);

  if (shared === undefined) return <div className="muted">Loading…</div>;
  if (shared === null) return <div className="error">This link doesn't contain a tier list.</div>;

  const count = TIERS.reduce((n, t) => n + shared.board[t].length, 0);
  const mineCount = BUCKETS.reduce((n, b) => n + mine[b].length, 0);
  const copy = async (replace: boolean) => {
    const current = Object.fromEntries(BUCKETS.map((b) => [b, mine[b].map((w) => w.key)])) as Record<Bucket, string[]>;
    await api.saveKeys(combine(current, shared.keys, replace));
    await reload();
    setAsking(false);
    setDone(replace ? "Your list is now this one." : `Added ${count} series to your list.`);
  };

  return (
    <div className="shared-page">
      <div className="page-head">
        <h1>{shared.title || "A shared tier list"}</h1>
        <span className="muted">
          {count} series
          {shared.missing > 0 && ` · ${shared.missing} more aren't in this version of the catalog`}
        </span>
        <div className="shared-actions">
          <button className={comparing ? "active" : ""} onClick={() => setComparing(!comparing)}>
            Compare with mine
          </button>
          <button onClick={() => (mineCount ? setAsking(true) : copy(true))}>Copy to my list</button>
        </div>
      </div>
      {asking && (
        <div className="notice transfer-confirm">
          <div>
            Your list has {mineCount} series. Replace it with this one, or add these {count}? Where a series is on both,
            this list's tier wins.
          </div>
          <div className="audible-actions">
            <button className="primary" onClick={() => copy(false)}>
              Add to my list
            </button>
            <button onClick={() => copy(true)}>Replace my list</button>
            <button className="link" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {done && (
        <div className="notice">
          {done} <a href="#/tierlist">Open your tier list</a> or <a href="#/foryou">see your picks</a>.
        </div>
      )}
      <div className="board">
        {TIERS.filter((t) => shared.board[t].length).map((t) => (
          <div key={t} className="tier-row">
            <div className={`tier-label tier-${t}`}>{t}</div>
            <div className="tier-items">
              <Tiles works={shared.board[t]} />
            </div>
          </div>
        ))}
      </div>
      {comparing && <Compare shared={shared} mine={mine} />}
      <p className="muted small shared-foot">
        Loot Table recommends LitRPG audiobooks from 900+ Reddit tier lists. <a href="#/tierlist">Make your own list</a>.
      </p>
    </div>
  );
}
