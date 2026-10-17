import { useRef, useState } from "react";
import { api, TIERS, type Bucket } from "../api";
import { useBoard } from "../board";
import { combine, fileName, saveText, toFile, type Imported } from "../transfer";
import SharePanel from "./SharePanel";

const BUCKETS: Bucket[] = [...TIERS, "unplaced"];

/** Share the tier list as a link; export it to a file, or import one (replacing the list, or adding to it). */
export default function TierTransfer() {
  const { board, reload } = useBoard();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Imported | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [sharing, setSharing] = useState(false);
  const mine = BUCKETS.reduce((n, b) => n + board[b].length, 0);
  const ranked = mine - board.unplaced.length;

  const exportList = async () => {
    try {
      if (await saveText(fileName(), toFile(board))) setMessage({ text: `Exported ${mine} series.` });
    } catch (e) {
      setMessage({ text: `Couldn't save the file: ${e}`, error: true });
    }
  };

  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = ""; // the same file can be picked again
    if (!file) return;
    setMessage(null);
    try {
      const read = await api.readTierlistFile(await file.text());
      if (!read.found) throw new Error("None of the series in that file are in this app's catalog.");
      if (mine === 0) await apply(read, true); // nothing to lose: no need to ask
      else setPending(read);
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  };

  const apply = async (read: Imported, replace: boolean) => {
    const current = Object.fromEntries(BUCKETS.map((b) => [b, board[b].map((w) => w.key)])) as Record<Bucket, string[]>;
    await api.saveKeys(combine(current, read.tiers, replace));
    await reload();
    setPending(null);
    const missing = read.missing.length
      ? ` ${read.missing.length} not in the catalog: ${read.missing.slice(0, 5).join(", ")}${read.missing.length > 5 ? "…" : ""}`
      : "";
    setMessage({ text: `Imported ${read.found} series.${missing}` });
  };

  return (
    <div className="transfer">
      <div className="transfer-buttons">
        <button
          className={sharing ? "active" : ""}
          onClick={() => setSharing(!sharing)}
          disabled={ranked === 0}
          title="A link to your tier list"
        >
          Share
        </button>
        <button onClick={exportList} disabled={mine === 0} title="Save your tier list to a file">
          Export
        </button>
        <button onClick={() => input.current?.click()} title="Load a tier list from a file">
          Import
        </button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      {sharing && ranked > 0 && <SharePanel onClose={() => setSharing(false)} />}
      {pending && (
        <div className="notice transfer-confirm">
          <div>
            The file has {pending.found} series
            {pending.missing.length > 0 &&
              ` (${pending.missing.length} more ${pending.missing.length === 1 ? "isn't" : "aren't"} in the catalog)`}
            . Your list has {mine}.
          </div>
          <div className="audible-actions">
            <button className="primary" onClick={() => apply(pending, true)}>
              Replace my list
            </button>
            <button onClick={() => apply(pending, false)} title="Where a series is on both, the file's tier wins">
              Add to my list
            </button>
            <button className="link" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && <div className={`small ${message.error ? "error" : "muted"}`}>{message.text}</div>}
    </div>
  );
}
