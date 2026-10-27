"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string; // muted text after the label, e.g. "not available here"
}

interface Props {
  value: string;
  options: DropdownOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean; // field names render in the mono face
}

const MENU_MAX = 260;

/**
 * Styled replacement for <select>. Native select menus can't be styled (macOS draws its own glass popup),
 * so this renders the menu itself, in a portal so panels with overflow or transforms never clip it.
 */
export function Dropdown({ value, options, onChange, placeholder = "Choose…", mono }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);
  const font = mono ? "font-mono text-[13px]" : "";

  const show = () => {
    const i = options.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  };
  const pick = (o: DropdownOption) => {
    onChange(o.value);
    setOpen(false);
    button.current?.focus();
  };

  // Place the menu under the button, or above it when there isn't room below.
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const width = Math.max(r.width, 180);
    setPos(
      below < MENU_MAX + 12 && r.top > below
        ? { left: r.left, width, bottom: window.innerHeight - r.top + 4 }
        : { left: r.left, width, top: r.bottom + 4 },
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[aria-selected=true]")?.scrollIntoView({ block: "nearest" });
    const outside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const scroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const resize = () => setOpen(false);
    document.addEventListener("mousedown", outside);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("mousedown", outside);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", resize);
    };
  }, [open]);

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "ArrowDown") setActive((a) => Math.min(options.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(options.length - 1);
    else if ((e.key === "Enter" || e.key === " ") && options[active]) pick(options[active]);
    else if (e.key === "Escape" || e.key === "Tab") setOpen(false);
    else return;
    if (e.key !== "Tab") e.preventDefault();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={`flex w-full items-center justify-between gap-2 rounded border bg-paper px-3 py-2 text-left text-[14px] transition outline-none ${
          open ? "border-ink" : "border-line-strong hover:border-ink-2 focus-visible:border-ink"
        }`}
      >
        <span className={`min-w-0 truncate ${current ? `text-ink ${font}` : "text-faint"}`}>
          {current ? current.label : placeholder}
          {current?.hint && <span className="ml-1.5 font-sans text-[12px] text-warn">{current.hint}</span>}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="listbox"
            style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: MENU_MAX }}
            className="animate-pop z-[100] overflow-y-auto rounded-lg bg-paper p-1 shadow-[0_12px_32px_rgb(46_31_31/0.14)] ring-1 ring-line"
          >
            {options.length === 0 && <div className="px-2.5 py-2 text-[13px] text-muted">Nothing to choose yet.</div>}
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <div
                  key={o.value}
                  id={`${id}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded px-2.5 py-1.5 text-[13.5px] ${
                    selected ? "bg-crimson-soft font-semibold text-crimson" : i === active ? "bg-cream text-ink" : "text-ink-2"
                  }`}
                >
                  <span className={`min-w-0 truncate ${font}`}>
                    {o.label}
                    {o.hint && <span className="ml-1.5 font-sans text-[12px] font-normal text-warn">{o.hint}</span>}
                  </span>
                  {selected && <Check size={14} className="shrink-0" />}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
