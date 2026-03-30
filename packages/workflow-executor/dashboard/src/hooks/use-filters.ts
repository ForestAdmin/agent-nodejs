import { useCallback, useState } from 'react';

import type { EventCategory, Filters, PairStatus, StatusFilters, ViewMode } from '../types';

const STORAGE_KEY = 'wf-debug-filters';
const STATUS_STORAGE_KEY = 'wf-debug-status-filters';
const VIEW_MODE_KEY = 'wf-debug-view-mode';

function load<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore */
  }
  return fallback;
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export default function useFilters() {
  const [filters, setFilters] = useState<Filters>(() =>
    load(STORAGE_KEY, { poll: true, step: true, drain: true }),
  );
  const [statusFilters, setStatusFilters] = useState<StatusFilters>(() =>
    load(STATUS_STORAGE_KEY, {
      running: true,
      success: true,
      error: true,
      'awaiting-input': true,
    }),
  );
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    load(VIEW_MODE_KEY, 'timeline' as ViewMode),
  );
  const [searchQuery, setSearchQuery] = useState('');

  const toggle = useCallback((category: EventCategory) => {
    setFilters(prev => {
      const next = { ...prev, [category]: !prev[category] };
      save(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const toggleStatus = useCallback((status: PairStatus) => {
    setStatusFilters(prev => {
      const next = { ...prev, [status]: !prev[status] };
      save(STATUS_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const setMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    save(VIEW_MODE_KEY, mode);
  }, []);

  return {
    filters,
    toggle,
    statusFilters,
    toggleStatus,
    viewMode,
    setMode,
    searchQuery,
    setSearchQuery,
  };
}
