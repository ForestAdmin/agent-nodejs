import { useEffect, useRef } from 'react';

import type { EventPair, Filters, StatusFilters, ViewMode } from '../types';
import { currentAttempt, groupByRun } from '../utils';

import EmptyState from './EmptyState';
import EventRow from './EventRow';
import RunGroup from './RunGroup';

interface EventStreamProps {
  pairs: EventPair[];
  filters: Filters;
  statusFilters: StatusFilters;
  viewMode: ViewMode;
  searchQuery: string;
  now: number;
  onResultCount: (count: number) => void;
}

export default function EventStream({
  pairs,
  filters,
  statusFilters,
  viewMode,
  searchQuery,
  now,
  onResultCount,
}: EventStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const filtered = pairs.filter(p => {
    if (!filters[p.category]) return false;
    if (!statusFilters[currentAttempt(p).status]) return false;
    if (searchQuery && p.category === 'step') {
      const runId = String(p.attempts[0]?.startData.runId ?? '');
      if (!runId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  const groups = viewMode === 'grouped' ? groupByRun(filtered) : [];

  const resultCount = viewMode === 'grouped' ? groups.length : filtered.length;
  useEffect(() => {
    onResultCount(resultCount);
  }, [resultCount, onResultCount]);

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filtered.length, groups.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
  };

  if (pairs.length === 0) {
    return (
      <div className="stream-container">
        <EmptyState />
      </div>
    );
  }

  if (viewMode === 'grouped') {
    const searchActive = searchQuery.length > 0;

    return (
      <div className="stream-container" ref={containerRef} onScroll={handleScroll}>
        {groups.map(group => (
          <RunGroup key={group.runId} group={group} now={now} searchQuery={searchQuery} />
        ))}
        {searchActive && groups.length === 0 && (
          <div className="no-results">
            No runs matching <span className="no-results-query">{searchQuery}</span>
          </div>
        )}
        {!searchActive && groups.length === 0 && (
          <div className="no-results">No step events yet</div>
        )}
      </div>
    );
  }

  return (
    <div className="stream-container" ref={containerRef} onScroll={handleScroll}>
      {filtered.map(pair => (
        <EventRow key={pair.id} pair={pair} now={now} />
      ))}
    </div>
  );
}
