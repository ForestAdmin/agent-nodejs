import { useCallback, useEffect, useState } from 'react';

import './App.css';
import EventStream from './components/EventStream';
import FilterBar from './components/FilterBar';
import Header from './components/Header';
import useEventStream from './hooks/use-event-stream';
import useFilters from './hooks/use-filters';

export default function App() {
  const { pairs, counters, status, clearEvents } = useEventStream();
  const {
    filters,
    toggle,
    statusFilters,
    toggleStatus,
    viewMode,
    setMode,
    searchQuery,
    setSearchQuery,
  } = useFilters();
  const [now, setNow] = useState(Date.now());
  const [resultCount, setResultCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleResultCount = useCallback((count: number) => {
    setResultCount(count);
  }, []);

  return (
    <>
      <Header status={status} counters={counters} onClear={clearEvents} />
      <FilterBar
        filters={filters}
        onToggle={toggle}
        statusFilters={statusFilters}
        onToggleStatus={toggleStatus}
        viewMode={viewMode}
        onSetMode={setMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        resultCount={resultCount}
      />
      <EventStream
        pairs={pairs}
        filters={filters}
        statusFilters={statusFilters}
        viewMode={viewMode}
        searchQuery={searchQuery}
        now={now}
        onResultCount={handleResultCount}
      />
    </>
  );
}
