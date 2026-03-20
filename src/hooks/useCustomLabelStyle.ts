'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStoredSession } from '@/lib/directAuth';
import type { SavedCustomStyle, LabelColorOverrides, CustomLabelConfig } from '@/lib/labelPresets';
import { extractColorOverrides } from '@/lib/labelPresets';

export type LabelStyleId = 'modern' | 'traditional' | 'custom-1' | 'custom-2' | 'custom-3' | 'custom-4';

interface UseCustomLabelStyleReturn {
  labelStyle: LabelStyleId;
  customStyles: SavedCustomStyle[];
  activeConfig: CustomLabelConfig | null;
  colorOverrides: LabelColorOverrides | undefined;
  loading: boolean;
  switchStyle: (id: LabelStyleId) => Promise<void>;
  saveCustomStyle: (style: { id?: string; name: string; config: CustomLabelConfig }) => Promise<SavedCustomStyle | null>;
  deleteCustomStyle: (id: string) => Promise<void>;
  renameCustomStyle: (id: string, name: string) => Promise<void>;
}

export function useCustomLabelStyle(): UseCustomLabelStyleReturn {
  const [labelStyle, setLabelStyle] = useState<LabelStyleId>('modern');
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
          setLabelStyle(data.labelStyle || 'modern');
          setCustomStyles(data.customStyles || []);
        }
      })
      .catch(err => console.error('Error fetching label style:', err))
      .finally(() => setLoading(false));
  }, [getAuthHeaders]);

  // Derive active config from custom styles
  const activeConfig = customStyles.find(s => s.id === labelStyle)?.config || null;
  const colorOverrides = extractColorOverrides(activeConfig);

  const switchStyle = useCallback(async (id: LabelStyleId) => {
    const headers = getAuthHeaders();
    if (!headers) return;

    setLabelStyle(id);
    try {
      await fetch('/api/user/label-style', {
        method: 'POST',
        headers,
        body: JSON.stringify({ labelStyle: id }),
      });
    } catch (err) {
      console.error('Failed to switch label style:', err);
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
