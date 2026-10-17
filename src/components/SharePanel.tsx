import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useBoard } from "../board";
import { MAX_TITLE, shareUrl } from "../share";

/** A link to my tier list, to post anywhere: the list is in the link itself. */
export default function SharePanel({ onClose }: { onClose: () => void }) {
  const { board } = useBoard();
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  // The board saves 400 ms after a change; the link is built from what's saved
  const signature = JSON.stringify(board, ["S", "A", "B", "C", "D", "F", "key"]);
  useEffect(() => {
    const t = window.setTimeout(
      () =>
        api.shareFragment(title).then(
          (f) => {
            setLink(shareUrl(f));
            setError(null);
          },
          (e) => {
            setLink("");
            setError(e instanceof Error ? e.message : String(e));
          },
        ),
      450,
    );
    setCopied(false);
    return () => window.clearTimeout(t);
  }, [title, signature]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // No clipboard API (older webviews): copy the selected text instead
      field.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
  };

  return (
    <div className="notice share-panel">
      <div className="share-head">
        <strong>Share your tier list</strong>
        <button className="link" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <input
        className="share-title"
        placeholder="Title (optional), e.g. My LitRPG favourites"
        value={title}
        maxLength={MAX_TITLE}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="share-link">
        <input ref={field} readOnly value={link} onFocus={(e) => e.target.select()} />
        <button className="primary" onClick={copy} disabled={!link}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      {error && <div className="error small">{error}</div>}
      <div className="muted small">
        Anyone with the link sees your ranked tiers ({link.length} characters). The list is in the link itself:
        nothing is uploaded.
      </div>
    </div>
  );
}
