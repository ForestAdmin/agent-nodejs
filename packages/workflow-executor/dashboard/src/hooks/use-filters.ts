import { useCallback, useState } from 'react';

import type { EventCategory, Filters, PairStatus, StatusFilters } from '../types';

const STORAGE_KEY = 'wf-debug-filters';
const STATUS_STORAGE_KEY = 'wf-debug-status-filters';

function loadFilters(): Filters {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore */
  }
  return { poll: true, step: true, drain: true };
}

function loadStatusFilters(): StatusFilters {
  try {
    const stored = localStorage.getItem(STATUS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore */
  }
  return { running: true, success: true, error: true, 'awaiting-input': true };
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export default function useFilters() {
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [statusFilters, setStatusFilters] = useState<StatusFilters>(loadStatusFilters);

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

  return { filters, toggle, statusFilters, toggleStatus };
}
