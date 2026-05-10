import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { LAB_MENU_ITEMS, type LabRoute } from "../constants/labRoutes";

type Props = {
  screen: string;
  isLabActive: boolean;
  onNavigate: (route: LabRoute) => void;
};

export const LabNavDropdown = ({ screen, isLabActive, onNavigate }: Props) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [screen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocPointer = (e: MouseEvent | TouchEvent) => {
      const node = containerRef.current;
      if (node && !node.contains(e.target as Node)) {
        setOpen(false);
      }
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
    if (!open) {
      return;
    }
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    first?.focus();
  }, [open]);

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

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={`${menuId}-trigger`}
          className="lab-dropdown-panel absolute right-0 z-50 mt-2 max-h-[min(70vh,28rem)] w-[min(calc(100vw-2rem),18rem)] overflow-y-auto rounded-xl border border-celestial-border/80 bg-[rgba(4,8,7,0.92)] py-2 shadow-celestial backdrop-blur-md md:w-72"
          onKeyDown={handleMenuKeyDown}
        >
          {LAB_MENU_ITEMS.map((item) => (
            <button
              key={item.route}
              type="button"
              role="menuitem"
              className="lab-dropdown-item flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left text-sm text-celestial-textMain transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-celestial-gold/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(4,8,7,0.95)]"
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
      )}
    </div>
  );
};
