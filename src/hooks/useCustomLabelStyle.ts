'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStoredSession } from '@/lib/directAuth';
import type { SavedCustomStyle, LabelColorOverrides, CustomLabelConfig } from '@/lib/labelPresets';
import { extractColorOverrides } from '@/lib/labelPresets';

// Custom slots run 'custom-1'..`custom-${MAX_SAVED_LABEL_STYLES}` (12 as of
// Aug 2026) — the template type accepts any slot number; the API validates
// the actual range.
export type LabelStyleId = 'modern' | 'traditional' | 'heritage' | `custom-${number}`;

interface UseCustomLabelStyleReturn {
  labelStyle: LabelStyleId;
  customStyles: SavedCustomStyle[];
  activeConfig: CustomLabelConfig | null;
  colorOverrides: LabelColorOverrides | undefined;
  loading: boolean;
  /**
   * Writes the ACCOUNT-WIDE default label style.
   *
   * ADDITIVE (card detail V2 review finding C): it now RESOLVES to whether the
   * save actually landed — `false` when there is no session, when the POST was
   * rejected, or when the request threw. It used to resolve to `undefined` in
   * all three cases, so a logged-out click and a failed save were both silent.
   * Every existing caller ignores the result and is unaffected.
   */
  switchStyle: (id: LabelStyleId) => Promise<boolean>;
  saveCustomStyle: (style: { id?: string; name: string; config: CustomLabelConfig }) => Promise<SavedCustomStyle | null>;
  deleteCustomStyle: (id: string) => Promise<void>;
  renameCustomStyle: (id: string, name: string) => Promise<void>;
}

export function useCustomLabelStyle(): UseCustomLabelStyleReturn {
  // Heritage is the product default for users who never picked a style.
  const [labelStyle, setLabelStyle] = useState<LabelStyleId>('heritage');
  const [customStyles, setCustomStyles] = useState<SavedCustomStyle[]>([]);
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = useCallback(() => {
    const session = getStoredSession();
    if (!session?.access_token) return null;
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    };
  }, []);

  // Fetch initial state
  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers) {
      setLoading(false);
      return;
    }

    fetch('/api/user/label-style', { headers })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setLabelStyle(data.labelStyle || 'heritage');
          setCustomStyles(data.customStyles || []);
        }
      })
      .catch(err => console.error('Error fetching label style:', err))
      .finally(() => setLoading(false));
  }, [getAuthHeaders]);

  // Derive active config from custom styles
  const activeConfig = customStyles.find(s => s.id === labelStyle)?.config || null;
  const colorOverrides = extractColorOverrides(activeConfig);

  const switchStyle = useCallback(async (id: LabelStyleId): Promise<boolean> => {
    const headers = getAuthHeaders();
    // No session: nothing can be saved. Returning false lets the caller say so
    // instead of leaving the click with no visible effect.
    if (!headers) return false;

    setLabelStyle(id);
    try {
      const res = await fetch('/api/user/label-style', {
        method: 'POST',
        headers,
        body: JSON.stringify({ labelStyle: id }),
      });
      return res.ok;
    } catch (err) {
      console.error('Failed to switch label style:', err);
      return false;
    }
  }, [getAuthHeaders]);

  const saveCustomStyle = useCallback(async (style: { id?: string; name: string; config: CustomLabelConfig }): Promise<SavedCustomStyle | null> => {
    const headers = getAuthHeaders();
    if (!headers) return null;

    try {
      const res = await fetch('/api/user/label-style', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'save', style }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomStyles(data.customStyles);
        return data.savedStyle;
      }
      if (data.error) {
        alert(data.error);
      }
      return null;
    } catch (err) {
      console.error('Failed to save custom style:', err);
      return null;
    }
  }, [getAuthHeaders]);

  const deleteCustomStyle = useCallback(async (id: string) => {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const res = await fetch('/api/user/label-style', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'delete', styleId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomStyles(data.customStyles);
        if (data.labelStyle) {
          setLabelStyle(data.labelStyle);
        }
      }
    } catch (err) {
      console.error('Failed to delete custom style:', err);
    }
  }, [getAuthHeaders]);

  const renameCustomStyle = useCallback(async (id: string, name: string) => {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
      const res = await fetch('/api/user/label-style', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'rename', styleId: id, name }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomStyles(data.customStyles);
      }
    } catch (err) {
      console.error('Failed to rename custom style:', err);
    }
  }, [getAuthHeaders]);

  return {
    labelStyle,
    customStyles,
    activeConfig,
    colorOverrides,
    loading,
    switchStyle,
    saveCustomStyle,
    deleteCustomStyle,
    renameCustomStyle,
  };
}
