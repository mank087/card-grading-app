'use client';

/**
 * Render a component's modals on <body> instead of inline, when a page asks.
 *
 * WHY. The card detail page renders shared components (the eBay listing
 * button, the download button) inside its own styled panels. Their modals are
 * `position: fixed` overlays rendered INLINE, so they inherited the panel's
 * styles: inside the dark InstaList panel the listing modal's title input took
 * `color: #fff` (white text on a white field, owner report Sept 23) and its
 * paragraphs a light grey, and inside `.dcm-brand` every modal heading took the
 * site's display size (32px instead of 20px). On the old page these modals sit
 * in a plain context, which is what a portal gives them back.
 *
 * ADDITIVE. `MaybePortal` renders its children in place unless an ancestor
 * `ModalPortalProvider` is present. Only the card detail page provides one, so
 * every other page renders these modals exactly as before.
 *
 * The portal wrapper carries `data-dcm-portal`, which globals.css uses to keep
 * form controls at 16px on phones (iOS zooms into anything smaller) — the rule
 * that used to reach these modals through the card detail page's own CSS.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const ModalPortalContext = createContext(false);

export function ModalPortalProvider({ children }: { children: ReactNode }) {
  return <ModalPortalContext.Provider value={true}>{children}</ModalPortalContext.Provider>;
}

export function MaybePortal({ children }: { children: ReactNode }) {
  const enabled = useContext(ModalPortalContext);
  // Portals need a document; render nothing until mounted on the client so the
  // server and first client render agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!enabled) return <>{children}</>;
  if (!mounted) return null;
  return createPortal(<div data-dcm-portal="">{children}</div>, document.body);
}
