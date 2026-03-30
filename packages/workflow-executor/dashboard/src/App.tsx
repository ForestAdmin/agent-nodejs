import { useEffect, useState } from 'react';

import './App.css';
import EventStream from './components/EventStream';
import FilterBar from './components/FilterBar';
import Header from './components/Header';
import useEventStream from './hooks/use-event-stream';
import useFilters from './hooks/use-filters';

export default function App() {
  const { pairs, counters, status, clearEvents } = useEventStream();
  const { filters, toggle, statusFilters, toggleStatus } = useFilters();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Header status={status} counters={counters} onClear={clearEvents} />
      <FilterBar
        filters={filters}
        onToggle={toggle}
        statusFilters={statusFilters}
        onToggleStatus={toggleStatus}
      />
      <EventStream pairs={pairs} filters={filters} statusFilters={statusFilters} now={now} />
    </>
  );
}
