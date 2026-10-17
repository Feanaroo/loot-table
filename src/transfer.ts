/** Tier list files: export your list, import it on another computer, browser or app.
 *
 * Series are stored by key ("series:B0..."), with title and author so a file still imports after a
 * dataset update changes a key, and so it can be read (and written) by hand. The private Audiorecs
 * app reads and writes the same format. */

import type { Board, Bucket } from "./api";
import type { DataWork, Index } from "./engine/data";
import { TIERS } from "./engine/recommend"; // not from api.ts, which imports this module
import { norm } from "./engine/text";

export const FORMAT = "loot-table-tierlist";
const BUCKETS: Bucket[] = [...TIERS, "unplaced"];

interface FileEntry {
  key?: string;
  title?: string;
  author?: string;
}

export interface TierlistFile {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  tiers: Partial<Record<Bucket, FileEntry[]>>;
}

export function toFile(board: Board): string {
  const file: TierlistFile = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    tiers: Object.fromEntries(
      BUCKETS.map((b) => [b, board[b].map((w) => ({ key: w.key, title: w.title, author: w.authors[0] ?? "" }))]),
    ),
  };
  return JSON.stringify(file, null, 2);
}

export const fileName = () => `tier-list-${new Date().toISOString().slice(0, 10)}.json`;

export interface Imported {
  /** Bucket -> work keys, in order */
  tiers: Record<Bucket, string[]>;
  found: number;
  /** Titles that matched nothing in this dataset */
  missing: string[];
}

/** Read a tier list file against the dataset. Throws with a readable message on a wrong file. */
export function readFile(text: string, index: Index): Imported {
  let file: TierlistFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a tier list (not JSON).");
  }
  if (file?.format !== FORMAT || typeof file.tiers !== "object") {
    throw new Error("That file isn't a tier list exported from Loot Table.");
  }
  // Fallbacks for keys this dataset doesn't have: title + author, then title alone if only one has it
  const byTitleAuthor = new Map<string, DataWork>();
  const byTitle = new Map<string, DataWork[]>();
  for (const w of index.data.works) {
    const t = norm(w.title);
    byTitleAuthor.set(`${t}|${norm(w.authors[0] ?? "")}`, w);
    byTitle.set(t, [...(byTitle.get(t) ?? []), w]);
  }
  const resolve = (e: FileEntry): string | null => {
    if (e.key && index.works.has(e.key)) return e.key;
    const t = norm(e.title ?? "");
    if (!t) return null;
    const exact = byTitleAuthor.get(`${t}|${norm(e.author ?? "")}`);
    if (exact) return exact.key;
    const same = byTitle.get(t) ?? [];
    return same.length === 1 ? same[0].key : null;
  };

  const tiers = Object.fromEntries(BUCKETS.map((b) => [b, [] as string[]])) as Record<Bucket, string[]>;
  const seen = new Set<string>();
  const missing: string[] = [];
  for (const b of BUCKETS) {
    for (const e of file.tiers[b] ?? []) {
      const key = resolve(e);
      if (!key) missing.push(e.title || e.key || "?");
      else if (!seen.has(key)) {
        seen.add(key); // listed twice: the first (higher) placement wins
        tiers[b].push(key);
      }
    }
  }
  return { tiers, found: seen.size, missing };
}

/** The imported list on its own, or added to mine: where a series is on both, the file's place wins */
export function combine(mine: Record<Bucket, string[]>, imported: Record<Bucket, string[]>, replace: boolean) {
  if (replace) return imported;
  const incoming = new Set(BUCKETS.flatMap((b) => imported[b]));
  return Object.fromEntries(
    BUCKETS.map((b) => [b, [...mine[b].filter((k) => !incoming.has(k)), ...imported[b]]]),
  ) as Record<Bucket, string[]>;
}

/** Save a text file: a Save dialog in the desktop app (webviews don't download reliably), a
 * download on the website. Returns false when the dialog was cancelled. */
export async function saveText(name: string, text: string): Promise<boolean> {
  if ("__TAURI_INTERNALS__" in window) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: name, filters: [{ name: "Tier list", extensions: ["json"] }] });
    if (!path) return false;
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, text);
    return true;
  }
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
