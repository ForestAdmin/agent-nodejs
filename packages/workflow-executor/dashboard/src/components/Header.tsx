import type { ConnectionStatus, Counters } from '../types';

interface HeaderProps {
  status: ConnectionStatus;
  counters: Counters;
  onClear: () => void;
}

export default function Header({ status, counters, onClear }: HeaderProps) {
  return (
    <div className="header">
      <div className={`vital-sign ${status}`} title={status} />
      <div className="brand">
        wf<span>:</span>executor
      </div>
      <div className="divider" />
      <div className="stats">
        <div>
          running{' '}
          <span className={`stat-value ${counters.running > 0 ? 'stat-active' : ''}`}>
            {counters.running}
          </span>
        </div>
        <div>
          awaiting{' '}
          <span className={`stat-value ${counters.awaiting > 0 ? 'stat-awaiting' : ''}`}>
            {counters.awaiting}
          </span>
        </div>
        <div>
          steps <span className="stat-value">{counters.steps}</span>
        </div>
        <div>
          errors{' '}
          <span className={`stat-value ${counters.errors > 0 ? 'stat-error' : ''}`}>
            {counters.errors}
          </span>
        </div>
      </div>
      <div className="header-spacer" />
      <button className="btn-clear" onClick={onClear}>
        clear
      </button>
    </div>
  );
}
