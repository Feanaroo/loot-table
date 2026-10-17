import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, TIERS, type Board, type Bucket, type Work } from "./api";

const EMPTY: Board = { S: [], A: [], B: [], C: [], D: [], F: [], unplaced: [] };

interface BoardApi {
  board: Board;
  loaded: boolean;
  saving: boolean;
  /** Replace the whole board (drag and drop) and save it. */
  setBoard: (b: Board) => void;
  /** Put a work at the end of a bucket, taking it out of wherever it was. */
  place: (work: Work, bucket: Bucket) => void;
  remove: (key: string) => void;
  bucketOf: (key: string) => Bucket | null;
  reload: () => Promise<void>;
}

const Ctx = createContext<BoardApi | null>(null);

export function BoardProvider({ children }: { children: ReactNode }) {
  const [board, setLocal] = useState<Board>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number>();
  // Latest board for place/remove, which can fire several times before a re-render
  const current = useRef<Board>(EMPTY);

  const reload = useCallback(async () => {
    current.current = { ...EMPTY, ...(await api.board()) };
    setLocal(current.current);
    setLoaded(true);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  const setBoard = useCallback((b: Board) => {
    current.current = b;
    setLocal(b);
    window.clearTimeout(timer.current);
    setSaving(true);
    // Debounced: a drag fires many updates
    timer.current = window.setTimeout(async () => {
      await api.saveBoard(b);
      setSaving(false);
    }, 400);
  }, []);

  const without = (b: Board, key: string): Board =>
    Object.fromEntries(Object.entries(b).map(([t, ws]) => [t, ws.filter((w) => w.key !== key)])) as Board;

  const place = useCallback(
    (work: Work, bucket: Bucket) => {
      const next = without(current.current, work.key);
      next[bucket] = [...next[bucket], { ...work, tier: bucket === "unplaced" ? null : bucket }];
      setBoard(next);
    },
    [setBoard],
  );

  const remove = useCallback((key: string) => setBoard(without(current.current, key)), [setBoard]);

  const bucketOf = useCallback(
    (key: string): Bucket | null => {
      for (const t of [...TIERS, "unplaced"] as Bucket[]) if (board[t].some((w) => w.key === key)) return t;
      return null;
    },
    [board],
  );

  return (
    <Ctx.Provider value={{ board, loaded, saving, setBoard, place, remove, bucketOf, reload }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBoard(): BoardApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBoard outside BoardProvider");
  return v;
}

// Opening the detail drawer from anywhere
export const DrawerCtx = createContext<(key: string) => void>(() => {});
export const useOpenWork = () => useContext(DrawerCtx);
