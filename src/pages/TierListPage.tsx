import { TIERS } from "../api";
import { useBoard } from "../board";
import TierBoard from "../components/TierBoard";
import TierTransfer from "../components/TierTransfer";
import WorkSearch from "../components/WorkSearch";

export default function TierListPage() {
  const { board, loaded } = useBoard();
  const ranked = TIERS.reduce((n, t) => n + board[t].length, 0);
  return (
    <div className="tierlist-page">
      <section className="board-col">
        <div className="page-head">
          <h1>My tier list</h1>
          <span className="muted">
            {ranked} ranked · {board.unplaced.length} to place — drag to reorder, click a cover for details
          </span>
          <TierTransfer />
        </div>
        {loaded && <TierBoard />}
        <p className="support small muted">
          Enjoying Loot Table?{" "}
          <a href="https://ko-fi.com/feanaro" target="_blank" rel="noreferrer">
            ☕ Support it on Ko-fi
          </a>
          <br />
          Contact: <a href="mailto:vityk202@gmail.com">vityk202@gmail.com</a>
        </p>
      </section>
      <aside className="search-col">
        <WorkSearch autoFocus />
      </aside>
    </div>
  );
}
