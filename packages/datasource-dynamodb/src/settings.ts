import type { CollectionSettings } from './types';

import PaginationCache from './utils/pagination-cache';

export const DEFAULT_MAX_SCANNED_ITEMS = 1000000;

export function resolveSettings(settings: Partial<CollectionSettings> = {}): CollectionSettings {
  const now = settings.now ?? (() => Date.now());

  return {
    scanPolicy: 'warn',
    maxScannedItems: DEFAULT_MAX_SCANNED_ITEMS,
    scanConcurrency: 4,
    approximateCount: false,
    chartCacheTtlMs: 30000,
    maxOffset: 100000,
    maxWriteRetries: 5,
    writeRetryBaseDelayMs: 50,
    logConsumedCapacity: false,
    logQueries: false,
    ...settings,
    now,
    paginationCache: settings.paginationCache ?? new PaginationCache({ now }),
    chartCaches: settings.chartCaches ?? new Map(),
  };
}
