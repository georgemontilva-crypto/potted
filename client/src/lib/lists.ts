import { useSyncExternalStore } from "react";

/**
 * Listas guardadas en el navegador del visitante (sin cuenta), como en el
 * sitio anterior: lista de deseos y comparador.
 */
function createList(key: string, max: number) {
  const read = (): number[] => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
      return Array.isArray(raw) ? raw.filter((n) => Number.isInteger(n)).slice(0, max) : [];
    } catch {
      return [];
    }
  };
  let ids: number[] = typeof localStorage === "undefined" ? [] : read();
  const listeners = new Set<() => void>();
  const set = (next: number[]) => {
    ids = next;
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      /* almacenamiento bloqueado: la lista vive mientras la página esté abierta */
    }
    listeners.forEach((l) => l());
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === key) {
        ids = read();
        listeners.forEach((l) => l());
      }
    });
  }
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return {
    max,
    has: (id: number) => ids.includes(id),
    /** Agrega o quita. Devuelve true si quedó agregado y el id que salió por el tope. */
    toggle(id: number): { added: boolean; dropped: number | null } {
      if (ids.includes(id)) {
        set(ids.filter((x) => x !== id));
        return { added: false, dropped: null };
      }
      const next = [...ids, id];
      const dropped = next.length > max ? next.shift()! : null;
      set(next);
      return { added: true, dropped };
    },
    remove: (id: number) => set(ids.filter((x) => x !== id)),
    clear: () => set([]),
    use: () => useSyncExternalStore(subscribe, () => ids, () => ids),
  };
}

export const wishlist = createList("potted.wishlist.v1", 60);
export const compare = createList("potted.compare.v1", 4);
