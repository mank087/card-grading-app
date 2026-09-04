"use client";

/**
 * Top-nav disclosure menu (W3C "disclosure navigation" pattern).
 *
 * Click opens and closes; hover opens as a convenience but never traps —
 * the menu stays open until a click outside, Escape, or focus leaving it.
 * The trigger is a real <button> with aria-expanded / aria-controls, so
 * keyboard users get Enter/Space for free and Escape returns focus to it.
 *
 * Built for the logged-out desktop nav (Pricing ▾, Resources ▾). Self-
 * contained on purpose: it owns its open state and outside-click handling
 * rather than adding more keys to Navigation.tsx's shared click-outside
 * effect.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavDropdownItem {
  href: string;
  label: string;
  /** One short line under the label, e.g. what a pricing tier is for. */
  description?: string;
}

interface Props {
  label: string;
  /** Where the label itself goes when the menu is open and the header line is clicked. */
  href?: string;
  items: NavDropdownItem[];
  /** Widens the panel when items carry descriptions. */
  width?: "w-56" | "w-72";
  /** Right-aligned panel for triggers at the right edge of the nav. */
  align?: "left" | "right";
  /**
   * Replace the plain text trigger (e.g. the credits balance pill). The
   * chevron is still appended; `triggerClassName` replaces the default
   * link-style classes entirely.
   */
  trigger?: ReactNode;
  triggerClassName?: string;
  /** Rendered after the items, inside the panel (e.g. a Log out button). */
  footer?: ReactNode;
  /** Optional accessible name when the visible trigger is not descriptive. */
  ariaLabel?: string;
}

export default function NavDropdown({
  label, href, items, width = "w-56", align = "left", trigger, triggerClassName, footer, ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);
  const panelId = useId();
  const pathname = usePathname();

  // The menu is "current" when the visitor is on any page it links to, so
  // the active underline still shows for pages that live inside a group.
  const active = items.some(i => pathname === i.href || (pathname?.startsWith(i.href + "/") ?? false))
    || (href ? pathname === href : false);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Close when the route changes (a Link inside was followed).
  useEffect(() => { setOpen(false); }, [pathname]);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    // Small grace period so the pointer can cross the gap into the panel.
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
      onBlur={(e) => {
        // Focus moved outside the whole menu (Tab past the last item).
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        aria-label={ariaLabel}
        className={triggerClassName ?? `flex items-center gap-1 px-2.5 xl:px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
          active ? "text-purple-700" : "text-gray-700 hover:text-purple-600"
        }`}
      >
        {trigger ?? label}
        <svg
          className={`w-3.5 h-3.5 opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {active && !trigger && <span aria-hidden="true" className="absolute left-3 right-3 -bottom-[13px] h-0.5 bg-purple-600 rounded-full" />}

      <div
        id={panelId}
        hidden={!open}
        className={`absolute top-full ${align === "right" ? "right-0" : "left-0"} pt-2 ${width} z-50`}
      >
        <div className="bg-white rounded-md shadow-lg border border-gray-200 py-1">
          {href && (
            <Link
              href={href}
              className="block px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-purple-50 hover:text-purple-700 border-b border-gray-100 mb-1"
            >
              {label} overview
            </Link>
          )}
          {items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2 hover:bg-purple-50 focus:outline-none focus-visible:bg-purple-50"
            >
              <span className={`block text-sm ${pathname === item.href ? "text-purple-700 font-semibold" : "text-gray-800"}`}>
                {item.label}
              </span>
              {item.description && (
                <span className="block text-xs text-gray-500 mt-0.5">{item.description}</span>
              )}
            </Link>
          ))}
          {footer}
        </div>
      </div>
    </div>
  );
}
