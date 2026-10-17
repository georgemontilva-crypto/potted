import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "motion/react";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { imageFor, useMoney, useShop } from "@/lib/shop";
import { cart, useCart } from "@/lib/cart";
import { trpc } from "@/lib/trpc";
import { CartDrawer } from "./CartDrawer";
import { FlyToCart } from "./FlyToCart";
import { SButton, SInput, StrainTag, errorText } from "./store";
import { cx } from "./ui";

const EASE = [0.28, 0.11, 0.32, 1] as const;

export function Brand({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const shop = useShop()!;
  const { logoUrl, storeName } = shop.settings;
  return (
    <Link href="/" aria-label={`${storeName} home`} className={cx("inline-flex items-center", className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={storeName}
          className={cx("w-auto object-contain", size === "lg" ? "h-24 sm:h-28" : "h-10 sm:h-11")}
        />
      ) : (
        <span className="serif text-[28px]">{storeName}</span>
      )}
    </Link>
  );
}

function useNavLinks() {
  const shop = useShop()!;
  const pages = shop.pages.filter((p) => p.showInNav);
  return {
    main: [
      { label: "Shop all", href: "/shop" },
      ...shop.categories.slice(0, 3).map((c) => ({ label: c.name, href: `/shop/${c.slug}` })),
      { label: "Lab Results", href: "/lab-results" },
      ...(shop.hasBlog ? [{ label: "Blog", href: "/blog" }] : []),
    ],
    more: [
      ...pages.map((p) => ({ label: p.title, href: `/${p.slug}` })),
      { label: "Wholesale", href: "/wholesale" },
      { label: "Contact", href: "/contact-us" },
      { label: "Track your order", href: "/track" },
    ],
  };
}

/* ───────────── Búsqueda ───────────── */

function SearchSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const money = useMoney();
  const [, navigate] = useLocation();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 200);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = trpc.store.products.useQuery({ search: term, sort: "destacados" }, { enabled: term.length >= 2 });
  const results = (q.data?.items ?? []).slice(0, 6);

  return (
    <div className="fixed inset-0 z-[70]">
      <motion.div
        className="absolute inset-0 bg-navy/35 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search products"
        className="absolute inset-x-3 top-3 mx-auto max-w-[720px] overflow-hidden rounded-[28px] bg-paper shadow-sheet"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <form
          className="flex items-center gap-3 px-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) {
              navigate(`/shop?q=${encodeURIComponent(text.trim())}`);
              onClose();
            }
          }}
        >
          <Search className="size-5 shrink-0 text-navy-3" aria-hidden />
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search strains, rosin, pre-rolls…"
            aria-label="Search products"
            className="h-16 min-w-0 flex-1 bg-transparent text-[19px] placeholder:text-navy-3 focus:outline-none"
          />
          <button type="button" onClick={onClose} aria-label="Close search" className="-mr-2 grid size-10 place-items-center rounded-full hover:bg-paper-2">
            <X className="size-5" />
          </button>
        </form>
        {term.length >= 2 && (
          <div className="border-t border-paper-3 p-3">
            {q.isLoading ? (
              <p className="px-3 py-6 text-[15px] text-navy-2">Searching…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-[15px] text-navy-2">Nothing matches “{term}”. Try a strain name like Gelato or Runtz.</p>
            ) : (
              <ul>
                {results.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/product/${p.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-4 rounded-[18px] p-2 transition-colors hover:bg-paper-2"
                    >
                      <span className="size-16 shrink-0 overflow-hidden rounded-[14px] bg-paper-2">
                        {imageFor(p.images) && <img src={imageFor(p.images)} alt="" className="size-full object-contain p-1.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="serif block truncate text-[18px]">{p.name}</span>
                        <StrainTag strain={p.strain} />
                      </span>
                      <span className="shrink-0 pr-2 text-[15px] font-semibold tabular-nums">{money(p.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ───────────── Encabezado ───────────── */

function Header() {
  const { count } = useCart();
  const links = useNavLinks();
  const [path] = useLocation();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setMenu(false), [path]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menu]);

  const active = (href: string) => (href === "/shop" ? path === "/shop" : path.startsWith(href));

  return (
    <>
      <header
        className={cx(
          "sticky top-0 z-50 border-b bg-paper/92 backdrop-blur-md transition-[border-color] duration-300",
          scrolled ? "border-paper-3" : "border-transparent",
        )}
      >
        <nav aria-label="Main" className="wrap flex h-[72px] items-center gap-4">
          <Brand />
          <ul className="mx-auto hidden items-center gap-1 xl:flex">
            {links.main.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active(l.href) ? "page" : undefined}
                  className={cx(
                    "rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors hover:bg-paper-2",
                    active(l.href) && "bg-paper-2",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-1 xl:ml-0">
            <Link href="/wholesale" className="mr-2 hidden rounded-full px-3.5 py-2 text-[15px] font-medium hover:bg-paper-2 xl:block">
              Wholesale
            </Link>
            <button
              type="button"
              aria-label="Search"
              onClick={() => setSearch(true)}
              className="grid size-11 place-items-center rounded-full transition-colors hover:bg-paper-2"
            >
              <Search className="size-[20px]" strokeWidth={1.9} />
            </button>
            <button
              type="button"
              aria-label={count > 0 ? `Open cart, ${count} items` : "Open cart"}
              onClick={() => cart.open()}
              data-cart-target
              className="relative grid size-11 place-items-center rounded-full transition-colors hover:bg-paper-2"
            >
              <motion.span
                key={count}
                className="grid place-items-center"
                initial={count > 0 ? { scale: 1, rotate: 0 } : false}
                animate={count > 0 ? { scale: [1, 1.35, 0.9, 1], rotate: [0, -14, 10, 0] } : undefined}
                transition={{ duration: 0.55, delay: 0.7 }}
              >
                <ShoppingBag className="size-[20px]" strokeWidth={1.9} />
              </motion.span>
              {count > 0 && (
                <motion.span
                  key={`n-${count}`}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.7 }}
                  className="absolute right-0.5 top-0.5 grid h-[19px] min-w-[19px] place-items-center rounded-full bg-sun px-1 text-[11px] font-bold leading-none text-navy"
                >
                  {count}
                </motion.span>
              )}
            </button>
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMenu(true)}
              className="grid size-11 place-items-center rounded-full transition-colors hover:bg-paper-2 xl:hidden"
            >
              <Menu className="size-[22px]" strokeWidth={1.9} />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div
            className="store fixed inset-0 z-[60] flex flex-col overflow-y-auto pb-10 xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="wrap flex h-[72px] items-center justify-between">
              <Brand />
              <button type="button" aria-label="Close menu" onClick={() => setMenu(false)} className="-mr-2 grid size-11 place-items-center rounded-full hover:bg-paper-2">
                <X className="size-6" />
              </button>
            </div>
            <ul className="wrap mt-6 flex flex-col">
              {links.main.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.03 + i * 0.03 }}
                >
                  <Link href={l.href} className="serif block py-2 text-[38px]">
                    {l.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <ul className="wrap mt-8 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-paper-3 pt-6">
              {links.more.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[16px] text-navy-2 hover:text-navy">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{search && <SearchSheet onClose={() => setSearch(false)} />}</AnimatePresence>
    </>
  );
}

/* ───────────── Boletín ───────────── */

export function Newsletter({ tone = "light" }: { tone?: "light" | "dark" }) {
  const shop = useShop()!;
  const n = shop.settings.newsletter;
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ coupon: string } | null>(null);
  const sub = trpc.store.subscribe.useMutation({
    onSuccess: (r) => setDone(r),
    onError: (e) => setError(errorText(e)),
  });
  if (!n.enabled) return null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    sub.mutate({ email: email.trim(), source: "newsletter" });
  };
  const dark = tone === "dark";
  return (
    <div className="grid items-end gap-8 md:grid-cols-[1fr_minmax(0,460px)]">
      <div>
        <h2 className="serif text-[clamp(2.2rem,5vw,3.6rem)]">{n.title}</h2>
        <p className={cx("mt-3 max-w-[42ch] text-[18px]", dark ? "text-paper/70" : "text-navy-2")}>{n.text}</p>
      </div>
      {done ? (
        <div role="status" className={cx("rounded-[22px] p-5", dark ? "bg-paper/10" : "bg-paper-2")}>
          <p className="text-[17px] font-semibold">You’re on the list.</p>
          {done.coupon ? (
            <p className={cx("mt-1 text-[15px]", dark ? "text-paper/75" : "text-navy-2")}>
              Use code <strong className="rounded-md bg-sun px-1.5 py-0.5 font-bold text-navy">{done.coupon}</strong> at checkout.
            </p>
          ) : (
            <p className={cx("mt-1 text-[15px]", dark ? "text-paper/75" : "text-navy-2")}>Watch your inbox for drops and deals.</p>
          )}
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className="flex gap-2">
            <SInput
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Your email"
              aria-label="Your email for the newsletter"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={dark ? "border-transparent bg-paper text-navy" : ""}
            />
            <SButton type="submit" tone="sun" className="h-12" loading={sub.isPending}>
              Subscribe
            </SButton>
          </div>
          {error && <p className={cx("mt-2 text-[14px]", dark ? "text-sun" : "text-cherry")}>{error}</p>}
        </form>
      )}
    </div>
  );
}

/* ───────────── Pie ───────────── */

function Footer() {
  const shop = useShop()!;
  const s = shop.settings;
  const navPages = shop.pages.filter((p) => p.showInNav);
  const legal = shop.pages.filter((p) => p.showInFooter && !p.showInNav);
  const social = [
    { label: "Instagram", href: s.instagram },
    { label: "TikTok", href: s.tiktok },
    { label: "Facebook", href: s.facebook },
  ].filter((x) => x.href);
  const linkClass = "text-[15px] text-paper/70 transition-colors hover:text-paper";

  return (
    <footer className="mt-28 bg-navy text-paper">
      <div className="wrap border-b border-paper/12 py-16">
        <Newsletter tone="dark" />
      </div>
      <div className="wrap grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <Brand size="lg" />
          <p className="mt-5 max-w-[30ch] text-[15px] text-paper/70">{s.tagline}</p>
        </div>
        <nav aria-label="Shop">
          <h2 className="text-[15px] font-semibold">Shop</h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link href="/shop" className={linkClass}>
                All products
              </Link>
            </li>
            {shop.categories.map((c) => (
              <li key={c.id}>
                <Link href={`/shop/${c.slug}`} className={linkClass}>
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/wholesale" className={linkClass}>
                Wholesale
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Information">
          <h2 className="text-[15px] font-semibold">Information</h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link href="/lab-results" className={linkClass}>
                Lab Results
              </Link>
            </li>
            {navPages.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className={linkClass}>
                  {p.title}
                </Link>
              </li>
            ))}
            {shop.hasBlog && (
              <li>
                <Link href="/blog" className={linkClass}>
                  Blog
                </Link>
              </li>
            )}
            <li>
              <Link href="/track" className={linkClass}>
                Track your order
              </Link>
            </li>
            {legal.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className={linkClass}>
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="text-[15px] font-semibold">
            <Link href="/contact-us" className="hover:underline">
              Contact
            </Link>
          </h2>
          <ul className="mt-4 space-y-2.5">
            {s.email && (
              <li>
                <a href={`mailto:${s.email}`} className={linkClass}>
                  {s.email}
                </a>
              </li>
            )}
            {s.supportEmail && (
              <li>
                <a href={`mailto:${s.supportEmail}`} className={linkClass}>
                  {s.supportEmail}
                </a>
              </li>
            )}
            {s.phone && (
              <li>
                <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className={linkClass}>
                  {s.phone}
                </a>
              </li>
            )}
            {s.address && <li className="max-w-[26ch] text-[15px] text-paper/70">{s.address}</li>}
            {social.map((x) => (
              <li key={x.label}>
                <a href={x.href} target="_blank" rel="noreferrer" className={linkClass}>
                  {x.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {s.disclaimer && (
        <div className="wrap border-t border-paper/12 py-8">
          <p className="max-w-[120ch] text-[12.5px] leading-relaxed text-paper/55">
            <strong className="font-semibold text-paper/75">Disclaimer: </strong>
            {s.disclaimer}
          </p>
        </div>
      )}
      <div className="wrap flex flex-wrap items-center justify-between gap-3 border-t border-paper/12 py-6 text-[13px] text-paper/50">
        <p>
          © {new Date().getFullYear()} {s.storeName}. All rights reserved.
        </p>
        <p>21+ only. Please consume responsibly.</p>
      </div>
    </footer>
  );
}

/* ───────────── Verificación de edad y cookies ───────────── */

const AGE_KEY = "potted.age.v1";
const COOKIE_KEY = "potted.cookies.v1";
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* almacenamiento bloqueado: se vuelve a preguntar la próxima vez */
  }
};

function AgeGate() {
  const shop = useShop()!;
  const g = shop.settings.ageGate;
  const [ok, setOk] = useState(() => read(AGE_KEY) === "yes");
  const [denied, setDenied] = useState(false);
  const [path] = useLocation();

  useEffect(() => {
    if (ok || !g.enabled) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [ok, g.enabled]);

  // Las páginas legales se pueden leer sin pasar la verificación.
  if (ok || !g.enabled || /^\/(privacy-policy|terms-of-service)$/.test(path)) return null;
  return (
    <div className="store fixed inset-0 z-[95] grid place-items-center overflow-y-auto p-5" role="dialog" aria-modal="true" aria-labelledby="age-title">
      <div className="pointer-events-none absolute -bottom-24 -right-16 w-[340px] opacity-25 sm:w-[460px]" aria-hidden>
        <img src="/brand/leaf.webp" alt="" className="w-full rotate-[18deg]" />
      </div>
      <div className="relative w-full max-w-[520px] text-center">
        <img src={shop.settings.logoUrl || "/brand/logo-potted.webp"} alt={shop.settings.storeName} className="mx-auto h-28 w-auto" />
        {denied ? (
          <>
            <h1 id="age-title" className="serif mt-8 text-[clamp(2.2rem,7vw,3.4rem)]">
              Access forbidden
            </h1>
            <p className="mt-4 text-[18px] text-navy-2">Your access is restricted because of your age. Come back when you’re {g.minAge}.</p>
          </>
        ) : (
          <>
            <h1 id="age-title" className="serif mt-8 text-[clamp(2.4rem,8vw,3.8rem)]">
              {g.title}
            </h1>
            <p className="mx-auto mt-4 max-w-[40ch] text-[18px] text-navy-2">{g.text}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <SButton
                size="lg"
                autoFocus
                onClick={() => {
                  write(AGE_KEY, "yes");
                  setOk(true);
                }}
              >
                I am {g.minAge} or older
              </SButton>
              <SButton size="lg" tone="outline" onClick={() => setDenied(true)}>
                I am under {g.minAge}
              </SButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CookieNotice() {
  const [show, setShow] = useState(() => read(COOKIE_KEY) !== "ok");
  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[65] mx-auto flex max-w-[560px] flex-wrap items-center gap-x-5 gap-y-3 rounded-[22px] bg-navy px-5 py-4 text-paper shadow-sheet sm:left-4 sm:right-auto sm:mx-0">
      <p className="min-w-0 flex-1 text-[14px] text-paper/85">
        We use cookies to improve your experience on our website. By browsing this website, you agree to our use of cookies.
      </p>
      <SButton
        tone="sun"
        size="sm"
        onClick={() => {
          write(COOKIE_KEY, "ok");
          setShow(false);
        }}
      >
        Accept
      </SButton>
    </div>
  );
}

export function StoreLayout({ children }: { children: ReactNode }) {
  const shop = useShop()!;
  const { announcement, announcementHref } = shop.settings;
  return (
    <div className="store flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-full focus:bg-navy focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      {announcement && (
        <div className="bg-sky text-center text-[13.5px] font-medium text-navy">
          {announcementHref ? (
            <Link href={announcementHref} className="wrap block py-2.5 hover:underline">
              {announcement}
            </Link>
          ) : (
            <p className="wrap py-2.5">{linkifyEmail(announcement)}</p>
          )}
        </div>
      )}
      <Header />
      <main id="content" className="flex-1">
        {children}
      </main>
      <Footer />
      <CartDrawer />
      <FlyToCart />
      <CookieNotice />
      <AgeGate />
    </div>
  );
}

/** Convierte los correos de un texto en enlaces mailto. */
function linkifyEmail(text: string) {
  const parts = text.split(/([\w.+-]+@[\w-]+\.[\w.]+)/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <a key={i} href={`mailto:${p}`} className="underline underline-offset-2">
        {p}
      </a>
    ) : (
      p
    ),
  );
}
