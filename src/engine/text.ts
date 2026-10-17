/** Normalising titles for search: "The Ten Realms: A Military Portal Fantasy LitRPG Series" -> "ten realms" */
export function norm(text: string): string {
  let t = text.toLowerCase().replace(/&/g, " and ");
  t = t.replace(/\(.*?\)|\[.*?\]/g, " ");
  t = t.replace(
    /[:\-–—]\s*(a|an|the)?\s*[^:]*(litrpg|gamelit|progression|fantasy|series|saga|cultivation|adventure|novel).*$/,
    "",
  );
  t = t.replace(/\b(series|saga|omnibus|books? \d+(-\d+)?)\b/g, " ");
  t = t.replace(/[^a-z0-9 ]+/g, " ");
  t = t.trim().replace(/^(the|a|an) /, "");
  return t.replace(/\s+/g, " ").trim();
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  const padded = ` ${s} `;
  for (let i = 0; i < padded.length - 1; i++) {
    const g = padded.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Similarity of two strings in 0..1 (Dice coefficient of letter pairs): forgives typos and missing letters */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const ga = bigrams(a);
  const gb = bigrams(b);
  let shared = 0;
  let total = 0;
  for (const [g, n] of ga) {
    shared += Math.min(n, gb.get(g) ?? 0);
    total += n;
  }
  for (const n of gb.values()) total += n;
  return (2 * shared) / total;
}
