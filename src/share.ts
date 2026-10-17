/** Share links: a tier list in the URL itself, so there's no server and nothing stored anywhere.
 *
 *   https://feanaroo.github.io/loot-table/#s=2k3Ab9Z.x_Q2.7m&t=My+favourites
 *
 * After "s=": a digit, how many characters each series takes (2 while the catalog has under
 * 4,096 series, then 3), then the tiers S A B C D F separated by dots, each a run of series codes
 * in their order; empty tiers at the end are left out. A code is the series' permanent number
 * (`sid`, never reused) in base 64 with URL-safe characters. "t=" is an optional title.
 * Only ranked tiers are shared, not "Listened". */

import type { Bucket } from "./api";
import type { Index } from "./engine/data";
import { TIERS } from "./engine/recommend";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** Where links point, also from the desktop app: anyone can open them in a browser */
export const SITE = "https://feanaroo.github.io/loot-table/";
export const MAX_TITLE = 60;

const code = (n: number, width: number) => {
  let s = "";
  for (let i = 0; i < width; i++, n = Math.floor(n / 64)) s = ALPHABET[n % 64] + s;
  return s;
};

const number = (s: string) => [...s].reduce((n, ch) => n * 64 + ALPHABET.indexOf(ch), 0);

/** The link's fragment (after "#") for a list given as keys per tier */
export function encode(tiers: Partial<Record<Bucket, string[]>>, index: Index, title = ""): string {
  const known = (k: string) => index.works.has(k);
  if (TIERS.some((t) => (tiers[t] ?? []).some((k) => known(k) && index.works.get(k)!.sid === undefined))) {
    // Data from before share numbers existed: an empty link would look fine and show nothing
    throw new Error("This page has an older copy of the catalog. Reload the page (Ctrl+F5) and try again.");
  }
  const sids = TIERS.map((t) => (tiers[t] ?? []).flatMap((k) => (known(k) ? [index.works.get(k)!.sid] : [])));
  const largest = Math.max(0, ...sids.flat());
  let width = 2;
  while (64 ** width <= largest) width++;
  const parts = sids.map((ns) => ns.map((n) => code(n, width)).join(""));
  while (parts.length && !parts[parts.length - 1]) parts.pop();
  const name = title.trim().slice(0, MAX_TITLE);
  // "+" for spaces reads better in a link than %20
  return `s=${width}${parts.join(".")}` + (name ? `&t=${encodeURIComponent(name).replace(/%20/g, "+")}` : "");
}

export interface Shared {
  tiers: Record<Bucket, string[]>;
  title: string;
  /** Codes in the link that this version of the catalog doesn't have */
  missing: number;
}

/** A share link's fragment, read against the catalog; null if it isn't one */
export function decode(fragment: string, index: Index): Shared | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const s = params.get("s");
  const width = Number(s?.[0]);
  if (!s || !(width >= 2 && width <= 4)) return null;
  const tiers = { S: [], A: [], B: [], C: [], D: [], F: [], unplaced: [] } as Record<Bucket, string[]>;
  const seen = new Set<string>();
  let missing = 0;
  const groups = s.slice(1).split(".");
  if (groups.length > TIERS.length) return null;
  for (const [i, group] of groups.entries()) {
    if (group.length % width || [...group].some((ch) => !ALPHABET.includes(ch))) return null;
    for (let j = 0; j < group.length; j += width) {
      const key = index.bySid.get(number(group.slice(j, j + width)));
      if (!key) missing++;
      else if (!seen.has(key)) {
        seen.add(key);
        tiers[TIERS[i]].push(key);
      }
    }
  }
  // URLSearchParams already turned "+" into spaces
  return { tiers, title: (params.get("t") ?? "").slice(0, MAX_TITLE), missing };
}

/** The full link: the website's address, also from the desktop app; the dev server's own when testing */
export function shareUrl(fragment: string): string {
  const local = !("__TAURI_INTERNALS__" in window) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  return `${local ? location.origin + location.pathname : SITE}#${fragment}`;
}

export const isShareHash = (hash: string) => /^#s=/.test(hash);
