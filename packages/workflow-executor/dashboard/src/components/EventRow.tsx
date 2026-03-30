import { useCallback, useState } from 'react';

import { currentAttempt } from '../hooks/use-event-stream';
import type { EventPair, PairAttempt, PairStatus } from '../types';
import { formatDuration, formatTime, trunc } from '../utils';

const STUCK_THRESHOLD_MS = 30_000;

const STATUS_ICONS: Record<PairStatus, string> = {
  running: '⏳',
  success: '✓',
  error: '✗',
  'awaiting-input': '⏸',
};

const STATUS_COLORS: Record<PairStatus, string> = {
  running: 'var(--blue)',
  success: 'var(--green)',
  error: 'var(--red)',
  'awaiting-input': 'var(--amber)',
};

function badgeLabel(pair: EventPair): string {
  if (pair.category === 'poll') return 'poll';
  if (pair.category === 'drain') return 'drain';
  const first = pair.attempts[0];
  return String(first.startData.stepType ?? 'step');
}

function AttemptSummary({ attempt, pair }: { attempt: PairAttempt; pair: EventPair }) {
  if (pair.category === 'poll') {
    if (attempt.endData) {
      return (
        <>
          <span className="key">found </span>
          <span className="val">{String(attempt.endData.stepsFound ?? 0)}</span>
          <span className="key"> steps</span>
        </>
      );
    }
    return <span className="key">fetching…</span>;
  }

  if (pair.category === 'drain') {
    if (attempt.endData) {
      return (
        <span className={attempt.endData.result === 'drained' ? 'val-green' : 'val-red'}>
          {String(attempt.endData.result ?? '?')}
        </span>
      );
    }
    return (
      <>
        <span className="key">in-flight </span>
        <span className="val-amber">{String(attempt.startData.inFlightCount ?? '?')}</span>
      </>
    );
  }

  const parts = [];
  parts.push(
    <span key="run" className="key">
      run <span className="val">{trunc(attempt.startData.runId)}</span>
    </span>,
  );
  parts.push(
    <span key="idx" className="key">
      {' · idx '}
      <span className="val">{String(attempt.startData.stepIndex ?? '?')}</span>
    </span>,
  );

  if (attempt.status === 'error' && attempt.endData?.error) {
    parts.push(
      <span key="err" className="val-red">
        {' · '}
        {trunc(attempt.endData.error, 40)}
      </span>,
    );
  }

  return <>{parts}</>;
}

function syntaxHighlight(json: string): string {
  return json
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/"([^"]*)"/g, '<span class="json-str">"$1"</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="json-num">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="json-bool">$1</span>');
}

function pairToText(pair: EventPair): string {
  return pair.attempts
    .map((a, i) => {
      const lines = [
        `--- attempt ${i + 1} [${a.status}] ---`,
        `start (${formatTime(a.startTime)}): ${JSON.stringify(a.startData, null, 2)}`,
      ];
      if (a.endData) {
        lines.push(`end (${a.endTime ? formatTime(a.endTime) : '?'}): ${JSON.stringify(a.endData, null, 2)}`);
      }
      if (a.durationMs !== undefined) {
        lines.push(`duration: ${a.durationMs}ms`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

function AttemptDetail({ attempt, index }: { attempt: PairAttempt; index: number }) {
  return (
    <div className="attempt-block">
      <div className="attempt-header">
        <span className={`attempt-badge status-${attempt.status}`}>
          {STATUS_ICONS[attempt.status]} {attempt.status}
        </span>
        <span className="attempt-label">attempt {index + 1}</span>
        <span className="attempt-time">
          {formatTime(attempt.startTime)}
          {attempt.endTime && ` → ${formatTime(attempt.endTime)}`}
        </span>
        {attempt.durationMs !== undefined && (
          <span className="attempt-duration">{formatDuration(attempt.durationMs)}</span>
        )}
      </div>
      <div className="detail-columns">
        <div className="detail-col">
          <div className="detail-label">start</div>
          <pre
            dangerouslySetInnerHTML={{
              __html: syntaxHighlight(JSON.stringify(attempt.startData, null, 2)),
            }}
          />
        </div>
        {attempt.endData && (
          <div className="detail-col">
            <div className="detail-label">
              {attempt.status === 'error' && !attempt.endData.status ? 'error' : 'end'}
            </div>
            <pre
              dangerouslySetInnerHTML={{
                __html: syntaxHighlight(JSON.stringify(attempt.endData, null, 2)),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface EventRowProps {
  pair: EventPair;
  now: number;
}

export default function EventRow({ pair, now }: EventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const attempt = currentAttempt(pair);
  const isRunning = attempt.status === 'running';
  const elapsed = isRunning ? now - attempt.startTime.getTime() : attempt.durationMs;
  const isStuck = isRunning && elapsed !== undefined && elapsed > STUCK_THRESHOLD_MS;
  const isPoll = pair.category === 'poll';
  const hasMultipleAttempts = pair.attempts.length > 1;

  const barColor = isStuck ? 'var(--red)' : STATUS_COLORS[attempt.status];

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(pairToText(pair));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    [pair],
  );

  const rowClass = [
    'event-row',
    isPoll ? 'event-row-poll' : '',
    isStuck ? 'event-row-stuck' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className={rowClass} onClick={() => setExpanded(e => !e)}>
        <span className="event-time">{formatTime(attempt.startTime)}</span>
        <span className={`event-badge badge-${pair.category}`}>{badgeLabel(pair)}</span>
        {hasMultipleAttempts && (
          <span className="attempt-count" title={`${pair.attempts.length} attempts`}>
            ×{pair.attempts.length}
          </span>
        )}
        <span className="duration-bar-container">
          <span
            className={`duration-bar ${isRunning ? 'duration-bar-pulse' : ''}`}
            style={{
              backgroundColor: barColor,
              width: isRunning ? '60%' : '100%',
            }}
          />
        </span>
        <span className="event-duration">{formatDuration(elapsed)}</span>
        <span className="event-summary">
          <AttemptSummary attempt={attempt} pair={pair} />
        </span>
        <span className={`status-icon status-${attempt.status}`}>
          {isStuck ? '⚠' : STATUS_ICONS[attempt.status]}
        </span>
      </div>
      {expanded && (
        <div className="event-detail open">
          <button className="btn-copy" onClick={handleCopy}>
            {copied ? '✓ copied' : 'copy'}
          </button>
          {pair.attempts.map((a, i) => (
            <AttemptDetail key={i} attempt={a} index={i} />
          ))}
        </div>
      )}
    </>
  );
}
