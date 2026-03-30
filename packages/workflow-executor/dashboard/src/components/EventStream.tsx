import { useEffect, useRef } from 'react';

import { currentAttempt } from '../hooks/use-event-stream';
import type { EventPair, Filters, StatusFilters } from '../types';

import EmptyState from './EmptyState';
import EventRow from './EventRow';

interface EventStreamProps {
  pairs: EventPair[];
  filters: Filters;
  statusFilters: StatusFilters;
  now: number;
}

export default function EventStream({ pairs, filters, statusFilters, now }: EventStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const filtered = pairs.filter(
    p => filters[p.category] && statusFilters[currentAttempt(p).status],
  );

  useEffect(() => {
    if (autoScrollRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filtered.length]);

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

  return (
    <div className="stream-container" ref={containerRef} onScroll={handleScroll}>
      {filtered.map(pair => (
        <EventRow key={pair.id} pair={pair} now={now} />
      ))}
    </div>
  );
}
