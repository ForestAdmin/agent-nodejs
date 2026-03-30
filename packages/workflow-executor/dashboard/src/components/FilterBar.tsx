import { Tooltip } from 'react-tooltip';

import type { EventCategory, Filters, PairStatus, StatusFilters } from '../types';

const CATEGORY_TOOLTIPS: Record<EventCategory, string> = {
  poll: 'Periodic fetch of pending steps from the orchestrator',
  step: 'Execution lifecycle of individual workflow steps',
  drain: 'Shutdown events — only emitted when the executor stops gracefully',
};

const STATUS_LABELS: Record<PairStatus, string> = {
  running: '⏳ running',
  success: '✓ success',
  error: '✗ error',
  'awaiting-input': '⏸ awaiting',
};

const CATEGORIES: EventCategory[] = ['poll', 'step', 'drain'];
const STATUSES: PairStatus[] = ['running', 'success', 'error', 'awaiting-input'];

interface FilterBarProps {
  filters: Filters;
  onToggle: (category: EventCategory) => void;
  statusFilters: StatusFilters;
  onToggleStatus: (status: PairStatus) => void;
}

export default function FilterBar({
  filters,
  onToggle,
  statusFilters,
  onToggleStatus,
}: FilterBarProps) {
  return (
    <div className="filters">
      {CATEGORIES.map(cat => (
        <button
          key={cat}
          className={`filter-btn ${filters[cat] ? 'active' : ''}`}
          data-category={cat}
          data-tooltip-id="filter-tooltip"
          data-tooltip-content={CATEGORY_TOOLTIPS[cat]}
          onClick={() => onToggle(cat)}
        >
          {cat}
        </button>
      ))}
      <span className="filter-divider" />
      {STATUSES.map(status => (
        <button
          key={status}
          className={`filter-btn filter-status ${statusFilters[status] ? 'active' : ''}`}
          data-status={status}
          onClick={() => onToggleStatus(status)}
        >
          {STATUS_LABELS[status]}
        </button>
      ))}
      <Tooltip
        id="filter-tooltip"
        place="bottom"
        delayShow={200}
        style={{
          backgroundColor: 'var(--bg-elevated)',
          color: 'var(--text-secondary)',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-sans)',
          padding: '5px 10px',
          borderRadius: '4px',
          border: '1px solid var(--border)',
          zIndex: 300,
        }}
      />
    </div>
  );
}
