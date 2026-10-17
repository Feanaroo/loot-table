import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { BoardProvider, DrawerCtx } from "./board";
import WorkDrawer from "./components/WorkDrawer";
import CommunityPage from "./pages/CommunityPage";
import ForYouPage from "./pages/ForYouPage";
import TierListPage from "./pages/TierListPage";

const PAGES = {
  tierlist: { label: "Tier list", Component: TierListPage },
  foryou: { label: "For you", Component: ForYouPage },
  community: { label: "Community", Component: CommunityPage },
} as const;
type PageId = keyof typeof PAGES;

const pageFromHash = (): PageId => {
  const id = window.location.hash.replace("#/", "") as PageId;
  return id in PAGES ? id : "tierlist";
};

/** How fresh the data is */
function DataDate() {
  const [built, setBuilt] = useState<string | null>(null);
  useEffect(() => {
    api.builtAt().then(setBuilt, () => setBuilt(null));
  }, []);
  if (!built) return null;
  const date = new Date(built).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return <span className="save-state" title="When the Reddit and Audible data was collected">Data: {date}</span>;
}

export default function App() {
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [drawer, setDrawer] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const close = useCallback(() => setDrawer(null), []);
  const { Component } = PAGES[page];

  return (
    <BoardProvider>
      <DrawerCtx.Provider value={setDrawer}>
        <header className="top">
          <a className="brand" href="#/tierlist">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={22} height={22} />
            Loot Table
          </a>
          <nav>
            {(Object.keys(PAGES) as PageId[]).map((id) => (
              <a key={id} href={`#/${id}`} className={page === id ? "active" : ""}>
                {PAGES[id].label}
              </a>
            ))}
          </nav>
          <DataDate />
        </header>
        <main>
          <Component />
        </main>
        <WorkDrawer workKey={drawer} onClose={close} />
      </DrawerCtx.Provider>
    </BoardProvider>
  );
}
