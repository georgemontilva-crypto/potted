import { useSyncExternalStore } from "react";

export type CartLine = { variantId: number; quantity: number };
type State = { lines: CartLine[]; open: boolean };

const KEY = "potted.cart.v1";
const MAX_QTY = 20;

function load(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((l) => Number.isInteger(l?.variantId) && Number.isInteger(l?.quantity) && l.quantity > 0)
      .map((l) => ({ variantId: l.variantId, quantity: Math.min(MAX_QTY, l.quantity) }));
  } catch {
    return [];
  }
}

let state: State = { lines: typeof localStorage === "undefined" ? [] : load(), open: false };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  if (next.lines) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state.lines));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  }
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) set({ lines: load() });
  });
}

/** Animación "vuela al carrito": de dónde sale y qué imagen lleva. */
export type Flight = { id: number; src: string; from: DOMRect };
const flightListeners = new Set<(f: Flight) => void>();
let flightSeq = 0;
export function onFlight(fn: (f: Flight) => void) {
  flightListeners.add(fn);
  return () => {
    flightListeners.delete(fn);
  };
}
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export const cart = {
  /**
   * Agrega al carrito. Si llega `from` (la foto del producto), la foto vuela
   * hasta el ícono del carrito y luego se abre el carrito.
   */
  add(variantId: number, quantity = 1, from?: { el: Element | null; src?: string }) {
    const found = state.lines.find((l) => l.variantId === variantId);
    const lines = found
      ? state.lines.map((l) =>
          l.variantId === variantId ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + quantity) } : l,
        )
      : [...state.lines, { variantId, quantity: Math.min(MAX_QTY, quantity) }];
    const rect = from?.el?.getBoundingClientRect();
    if (rect && from?.src && flightListeners.size > 0 && !reducedMotion()) {
      const flight = { id: ++flightSeq, src: from.src, from: rect };
      flightListeners.forEach((l) => l(flight));
      set({ lines });
      setTimeout(() => set({ open: true }), 750);
      return;
    }
    set({ lines, open: true });
  },
  setQuantity(variantId: number, quantity: number) {
    if (quantity <= 0) return cart.remove(variantId);
    set({
      lines: state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)),
    });
  },
  remove(variantId: number) {
    set({ lines: state.lines.filter((l) => l.variantId !== variantId) });
  },
  clear() {
    set({ lines: [] });
  },
  open() {
    set({ open: true });
  },
  close() {
    set({ open: false });
  },
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useCart() {
  const s = useSyncExternalStore(subscribe, () => state);
  return { ...s, count: s.lines.reduce((n, l) => n + l.quantity, 0) };
}
