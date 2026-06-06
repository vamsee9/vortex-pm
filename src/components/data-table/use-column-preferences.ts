"use client";

import { useState, useEffect } from "react";
import type { ColumnDefinition } from "@/lib/types";

export interface ColumnPreference {
  key: string;
  isVisible: boolean;
  order: number;
  width: number;
}

export function useColumnPreferences(projectId: string, defaultColumns: ColumnDefinition[]) {
  const [preferences, setPreferences] = useState<Record<string, ColumnPreference>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    
    const storageKey = `vortex_columns_${projectId}`;
    const stored = localStorage.getItem(storageKey);
    
    let parsed: Record<string, ColumnPreference> = {};
    if (stored) {
      try {
        parsed = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse column preferences");
      }
    }

    // Merge with defaults for new columns
    const merged: Record<string, ColumnPreference> = { ...parsed };
    let orderCounter = Object.keys(parsed).length;
    
    defaultColumns.forEach((col) => {
      if (!merged[col.key]) {
        merged[col.key] = {
          key: col.key,
          isVisible: col.is_visible,
          order: col.display_order ?? orderCounter++,
          width: col.width_px || 120,
        };
      }
    });

    setPreferences(merged);
    setIsLoaded(true);
  }, [projectId, defaultColumns]);

  const updatePreference = (key: string, updates: Partial<ColumnPreference>) => {
    setPreferences((prev) => {
      const next = {
        ...prev,
        [key]: { ...prev[key], ...updates },
      };
      localStorage.setItem(`vortex_columns_${projectId}`, JSON.stringify(next));
      return next;
    });
  };

  const setAllPreferences = (newPrefs: Record<string, ColumnPreference>) => {
    setPreferences(newPrefs);
    localStorage.setItem(`vortex_columns_${projectId}`, JSON.stringify(newPrefs));
  };

  return { preferences, updatePreference, setAllPreferences, isLoaded };
}
