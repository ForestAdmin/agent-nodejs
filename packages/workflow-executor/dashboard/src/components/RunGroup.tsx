import { useCallback, useState } from 'react';

import type { RunGroup as RunGroupType } from '../types';
import { formatDuration, trunc } from '../utils';

import EventRow from './EventRow';

const STATUS_COLORS: Record<string, string> = {
  running: 'var(--blue)',
  success: 'var(--green)',
  error: 'var(--red)',
  'awaiting-input': 'var(--amber)',
};

interface RunGroupProps {
  group: RunGroupType;
  now: number;
  searchQuery: string;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <span className="search-highlight">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function RunGroup({ group, now, searchQuery }: RunGroupProps) {
  const hasIssue =
    group.overallStatus === 'error' ||
    group.overallStatus === 'running' ||
    group.overallStatus === 'awaiting-input';

  const [open, setOpen] = useState(hasIssue);
  const [copied, setCopied] = useState(false);

  const handleCopyRunId = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(group.runId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    [group.runId],
  );

  const borderColor = STATUS_COLORS[group.overallStatus] ?? 'var(--grey)';

  return (
    <div className="run-group" style={{ borderLeftColor: borderColor }}>
      <div className="run-group-header" onClick={() => setOpen(o => !o)}>
        <span className="run-group-chevron">{open ? '▼' : '▶'}</span>
        <span
          className="run-group-dot"
          style={{ backgroundColor: borderColor }}
        />
        <span
          className={`run-group-id ${copied ? 'run-group-id-copied' : ''}`}
          onClick={handleCopyRunId}
          title="Click to copy full runId"
        >
          <HighlightMatch text={trunc(group.runId, 28)} query={searchQuery} />
        </span>
        <span className="run-group-count">
          {group.pairs.length} step{group.pairs.length > 1 ? 's' : ''}
        </span>
        <span className="run-group-statuses">
          {group.statuses.success > 0 && (
            <span className="mini-stat mini-stat-success">✓{group.statuses.success}</span>
          )}
          {group.statuses.error > 0 && (
            <span className="mini-stat mini-stat-error">✗{group.statuses.error}</span>
          )}
          {group.statuses.running > 0 && (
            <span className="mini-stat mini-stat-running">⏳{group.statuses.running}</span>
          )}
          {group.statuses.awaiting > 0 && (
            <span className="mini-stat mini-stat-awaiting">⏸{group.statuses.awaiting}</span>
          )}
        </span>
        <span className="run-group-duration">{formatDuration(group.totalDurationMs || undefined)}</span>
      </div>
      {open && (
        <div className="run-group-body">
          {group.pairs.map(pair => (
            <EventRow key={pair.id} pair={pair} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}
