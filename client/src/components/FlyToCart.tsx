import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { onFlight, type Flight } from "@/lib/cart";

/** Dibuja la foto del producto volando hasta el ícono del carrito. */
export function FlyToCart() {
  const [flights, setFlights] = useState<(Flight & { to: { x: number; y: number } })[]>([]);

  useEffect(
    () =>
      onFlight((f) => {
        const target = document.querySelector("[data-cart-target]")?.getBoundingClientRect();
        const to = target
          ? { x: target.left + target.width / 2, y: target.top + target.height / 2 }
          : { x: window.innerWidth - 40, y: 40 };
        setFlights((list) => [...list, { ...f, to }]);
        setTimeout(() => setFlights((list) => list.filter((x) => x.id !== f.id)), 900);
      }),
    [],
  );

  return createPortal(
    <AnimatePresence>
      {flights.map((f) => {
        const size = Math.min(f.from.width, f.from.height, 260);
        const startX = f.from.left + f.from.width / 2 - size / 2;
        const startY = f.from.top + f.from.height / 2 - size / 2;
        return (
          <motion.img
            key={f.id}
            src={f.src}
            alt=""
            aria-hidden
            className="pointer-events-none fixed left-0 top-0 z-[90] object-contain drop-shadow-[0_18px_22px_rgba(23,32,59,0.3)]"
            style={{ width: size, height: size }}
            initial={{ x: startX, y: startY, scale: 1, rotate: 0, opacity: 1 }}
            animate={{
              x: [startX, (startX + f.to.x) / 2, f.to.x - size / 2],
              y: [startY, Math.min(startY, f.to.y) - 120, f.to.y - size / 2],
              scale: [1, 0.7, 0.08],
              rotate: [0, -18, 30],
              opacity: [1, 1, 0.6],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.75, ease: [0.5, 0, 0.3, 1], times: [0, 0.45, 1] }}
          />
        );
      })}
    </AnimatePresence>,
    document.body,
  );
}
