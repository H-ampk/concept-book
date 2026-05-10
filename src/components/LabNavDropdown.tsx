import { createPortal } from "react-dom";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { LAB_MENU_ITEMS, type LabRoute } from "../constants/labRoutes";

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

type Props = {
  screen: string;
  isLabActive: boolean;
  onNavigate: (route: LabRoute) => void;
};

const MENU_MAX_W = 288;
const MENU_GAP = 8;
const VIEW_MARGIN = 8;

const clampMenuLeft = (rect: DOMRect, menuWidth: number): number => {
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const w = Math.min(menuWidth, vw - VIEW_MARGIN * 2);
  const preferredRight = rect.right;
  let left = preferredRight - w;
  left = Math.max(VIEW_MARGIN, left);
  left = Math.min(left, vw - w - VIEW_MARGIN);
  return left;
};

export const LabNavDropdown = ({ screen, isLabActive, onNavigate }: Props) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const measureMenuPosition = (): MenuPosition | null => {
    const btn = buttonRef.current;
    if (!btn) {
      return null;
    }
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const menuWidth = Math.min(MENU_MAX_W, vw - VIEW_MARGIN * 2);
    return {
      top: rect.bottom + MENU_GAP,
      left: clampMenuLeft(rect, menuWidth),
      width: menuWidth
    };
  };

  useEffect(() => {
    setOpen(false);
  }, [screen]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    const next = measureMenuPosition();
    setMenuPos(next);
    const onResizeOrScroll = () => {
      const p = measureMenuPosition();
      if (p) {
        setMenuPos(p);
      }
    };
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);
    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) {
        return;
      }
      if (menuRef.current?.contains(t)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !menuPos) {
      return;
    }
    requestAnimationFrame(() => {
      const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
      first?.focus();
    });
  }, [open, menuPos]);

  const toggle = () => setOpen((prev) => !prev);

  const handleButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
      return;
    }
    e.preventDefault();
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    if (!items?.length) {
      return;
    }
    const list = [...items];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "ArrowDown"
        ? Math.min(i < 0 ? 0 : i + 1, list.length - 1)
        : Math.max(i < 0 ? list.length - 1 : i - 1, 0);
    list[next]?.focus();
  };

  const menuPanel = open && menuPos ? (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-labelledby={`${menuId}-trigger`}
      className="lab-dropdown-panel lab-dropdown-panel--portal scrollbar-none fixed z-[45] max-h-[min(70vh,520px)] overflow-y-auto rounded-xl border border-celestial-border py-2 shadow-[0_20px_48px_rgba(0,0,0,0.55),0_0_0_1px_rgba(77,255,154,0.2),0_0_32px_rgba(77,255,154,0.12)] backdrop-blur-md"
      style={{
        top: menuPos.top,
        left: menuPos.left,
        width: menuPos.width,
        backgroundColor: "rgba(4, 10, 8, 0.96)"
      }}
      onKeyDown={handleMenuKeyDown}
    >
      {LAB_MENU_ITEMS.map((item) => (
        <button
          key={item.route}
          type="button"
          role="menuitem"
          className="lab-dropdown-item flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left text-sm text-celestial-textMain transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(4,10,8,0.98)]"
          onClick={() => {
            onNavigate(item.route);
            setOpen(false);
          }}
        >
          <span className="font-semibold text-celestial-softGold">{item.label}</span>
          <span className="text-xs leading-snug text-celestial-textSub line-clamp-2">{item.description}</span>
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className="lab-nav-dropdown relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        className={`header-nav-button rounded-md border border-celestial-gold/50 bg-transparent text-celestial-softGold hover:bg-celestial-gold/10 ${
          isLabActive ? "bg-celestial-gold/20" : ""
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        id={`${menuId}-trigger`}
        onClick={toggle}
        onKeyDown={handleButtonKeyDown}
      >
        Lab
      </button>

      {typeof document !== "undefined" && menuPanel != null ? createPortal(menuPanel, document.body) : null}
    </div>
  );
};
