import { Tooltip } from 'react-tooltip';

import type { EventCategory, Filters, PairStatus, StatusFilters, ViewMode } from '../types';

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
  viewMode: ViewMode;
  onSetMode: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  resultCount: number;
}

export default function FilterBar({
  filters,
  onToggle,
  statusFilters,
  onToggleStatus,
  viewMode,
  onSetMode,
  searchQuery,
  onSearchChange,
  resultCount,
}: FilterBarProps) {
  return (
    <div className="filters">
      <div className="view-mode-toggle">
        <button
          className={`view-mode-btn ${viewMode === 'timeline' ? 'active' : ''}`}
          onClick={() => onSetMode('timeline')}
        >
          timeline
        </button>
        <button
          className={`view-mode-btn ${viewMode === 'grouped' ? 'active' : ''}`}
          onClick={() => onSetMode('grouped')}
        >
          by run
        </button>
      </div>
      <span className="filter-divider" />
      {CATEGORIES.map(cat => {
        const disabled = viewMode === 'grouped' && cat !== 'step';
        return (
          <button
            key={cat}
            className={`filter-btn ${filters[cat] && !disabled ? 'active' : ''} ${disabled ? 'filter-btn-disabled' : ''}`}
            data-category={cat}
            data-tooltip-id="filter-tooltip"
            data-tooltip-content={disabled ? 'Not available in grouped view' : CATEGORY_TOOLTIPS[cat]}
            disabled={disabled}
            onClick={() => onToggle(cat)}
          >
            {cat}
          </button>
        );
      })}
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
      <span className="filter-divider" />
      <div className="search-container">
        <input
          className="search-input"
          type="text"
          placeholder="filter by runId..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <>
            <span className="search-count">
              {resultCount} {viewMode === 'grouped' ? 'runs' : 'events'}
            </span>
            <button className="search-clear" onClick={() => onSearchChange('')}>
              ×
            </button>
          </>
        )}
      </div>
      <Tooltip
        id="filter-tooltip"
        place="bottom"
        delayShow={200}
        border="1px solid var(--border)"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          color: 'var(--text-secondary)',
          fontSize: '0.72rem',
          fontFamily: 'var(--font-sans)',
          padding: '5px 10px',
          borderRadius: '4px',
          zIndex: 300,
        }}
      />
    </div>
  );
}
