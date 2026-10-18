/** Visitor counts for the website, with GoatCounter (goatcounter.com): no cookies, no IP addresses
 * stored, no personal data, so no consent banner. Only on the published site: never in the desktop
 * app, a dev server or a preview build.
 *
 * Counted per page ("/tierlist", "/foryou", "/community"); a share link counts as "/shared", never
 * with the list that's in its link. */

/** Your GoatCounter code: the "xyz" of xyz.goatcounter.com. Empty: counting is off. */
const CODE = "feanaro";
const SITE_HOST = "feanaroo.github.io";

// A pinned version of GoatCounter's script, checked by hash: a changed file wouldn't run
const SCRIPT = "https://gc.zgo.at/count.v4.js";
const INTEGRITY = "sha384-nRw6qfbWyJha9LhsOtSb2YJDyZdKvvCFh0fJYlkquSFjUxp9FVNugbfy8q1jdxI+";

interface GoatCounter {
  no_onload?: boolean;
  count?: (vars: { path: string; title?: string; referrer?: string; event?: boolean }) => void;
}
declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

/** The page, without anything personal: share links carry a whole tier list after "#s=" */
export function pagePath(hash: string): string {
  if (/^#s=/.test(hash)) return "/shared";
  const page = hash.replace(/^#\/?/, "").split(/[?&#]/)[0];
  return ["tierlist", "foryou", "community"].includes(page) ? `/${page}` : "/tierlist";
}

export function startAnalytics(): void {
  if (!CODE || "__TAURI_INTERNALS__" in window || location.hostname !== SITE_HOST) return;
  // Counted by hand: the app changes pages through the "#", which GoatCounter doesn't see itself
  window.goatcounter = { no_onload: true };
  let last = "";
  const count = () => {
    const path = pagePath(location.hash);
    if (path === last) return; // the same page again (a different shared list, a re-render)
    last = path;
    window.goatcounter?.count?.({ path, title: document.title });
  };
  const script = Object.assign(document.createElement("script"), {
    src: SCRIPT,
    async: true,
    integrity: INTEGRITY,
    crossOrigin: "anonymous",
  });
  script.dataset.goatcounter = `https://${CODE}.goatcounter.com/count`;
  script.addEventListener("load", () => {
    count();
    window.addEventListener("hashchange", count);
  });
  document.head.append(script);
}
