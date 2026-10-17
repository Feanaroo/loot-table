import { useEffect, useState } from "react";
import { api, type CommunityWork } from "../api";
import { useBoard, useOpenWork } from "../board";
import { Cover, Stars, TierButtons } from "../components/common";

export default function CommunityPage() {
  const [items, setItems] = useState<CommunityWork[] | null>(null);
  const [mainstream, setMainstream] = useState(false);
  const openWork = useOpenWork();
  const { bucketOf } = useBoard();

  useEffect(() => {
    api.community(mainstream).then(setItems);
  }, [mainstream]);

  if (!items) return <div className="muted">Loading…</div>;
  return (
    <div>
      <div className="page-head">
        <h1>Community ranking</h1>
        <span className="muted">
          The top 100 from Reddit tier lists: every "ranked higher than" in every list counts, each list counts the same.
        </span>
        <label className="toggle small">
          <input type="checkbox" checked={mainstream} onChange={(e) => setMainstream(e.target.checked)} />
          Include mainstream fantasy (Stormlight, Harry Potter…)
        </label>
      </div>
      {items.length === 0 && <div className="notice">No tier lists in the data.</div>}
      <table className="community">
        <thead>
          <tr>
            <th>#</th>
            <th />
            <th>Series</th>
            <th>Strength</th>
            <th>Lists</th>
            <th>Audible</th>
            <th>Mine</th>
          </tr>
        </thead>
        <tbody>
          {items.map((w, i) => (
            <tr key={w.key} onClick={() => openWork(w.key)} className={bucketOf(w.key) ? "mine" : ""}>
              <td className="muted">{i + 1}</td>
              <td>
                <Cover work={w} size={40} />
              </td>
              <td>
                <div>{w.title}</div>
                <div className="muted small">{w.authors.slice(0, 2).join(", ")}</div>
              </td>
              <td>
                <div className="bar">
                  <span style={{ width: `${Math.max(4, Math.min(100, 50 + w.quality * 20))}%` }} />
                </div>
              </td>
              <td>{w.lists}</td>
              <td>
                <Stars rating={w.rating} count={w.ratingCount} />
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <TierButtons work={w} compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
