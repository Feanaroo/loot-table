/** In the desktop app, links that leave the app (Audible, Ko-fi, email) open in the system browser
 * or mail app; a webview would otherwise open them inside the app window, or not at all. */
export function routeExternalLinks(): void {
  if (!("__TAURI_INTERNALS__" in window)) return; // the website: the browser handles it
  document.addEventListener("click", async (e) => {
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || !/^(https?|mailto):/.test(a.href) || new URL(a.href).origin === location.origin) return;
    e.preventDefault();
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(a.href);
  });
}
