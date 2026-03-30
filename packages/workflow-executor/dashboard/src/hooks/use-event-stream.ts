import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ConnectionStatus,
  Counters,
  EventCategory,
  EventPair,
  PairAttempt,
  PairStatus,
} from '../types';

const MAX_PAIRS = 500;
const EVENT_NAMES = [
  'poll:start',
  'poll:end',
  'step:start',
  'step:end',
  'step:error',
  'drain:start',
  'drain:end',
];

function categoryOf(type: string): EventCategory {
  if (type.startsWith('poll:')) return 'poll';
  if (type.startsWith('drain:')) return 'drain';
  return 'step';
}

function resolveStatus(type: string, data: Record<string, unknown>): PairStatus {
  if (type === 'step:error') return 'error';
  if (type === 'step:end') {
    const s = data.status as string | undefined;
    if (s === 'error') return 'error';
    if (s === 'awaiting-input') return 'awaiting-input';
    return 'success';
  }
  if (type === 'poll:end') return 'success';
  if (type === 'drain:end') return data.result === 'timeout' ? 'error' : 'success';
  return 'success';
}

function currentAttempt(pair: EventPair): PairAttempt {
  return pair.attempts[pair.attempts.length - 1];
}

export { currentAttempt };

export default function useEventStream() {
  const [pairs, setPairs] = useState<EventPair[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('error');

  const nextId = useRef(0);
  const pollCounter = useRef(0);
  const drainCounter = useRef(0);
  const pairMap = useRef(new Map<string, EventPair>());

  const clearEvents = useCallback(() => {
    pairMap.current.clear();
    setPairs([]);
    pollCounter.current = 0;
    drainCounter.current = 0;
  }, []);

  useEffect(() => {
    const es = new EventSource('/debug/events');

    es.onopen = () => setStatus('connected');
    es.onerror = () => {
      setStatus(es.readyState === EventSource.CONNECTING ? 'reconnecting' : 'error');
    };

    EVENT_NAMES.forEach(eventType => {
      es.addEventListener(eventType, (e: MessageEvent) => {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(e.data);
        } catch {
          /* ignore */
        }

        const isStart = eventType.endsWith(':start');
        const category = categoryOf(eventType);
        const now = new Date();
        const map = pairMap.current;

        if (isStart) {
          let key: string;
          if (category === 'poll') {
            pollCounter.current += 1;
            key = `poll-${pollCounter.current}`;
          } else if (category === 'drain') {
            drainCounter.current += 1;
            key = `drain-${drainCounter.current}`;
          } else {
            key = `step-${data.runId}:${data.stepId}`;
          }

          const existing = map.get(key);

          if (existing) {
            // Push a new attempt (resume after awaiting-input, or retry)
            existing.attempts.push({
              startTime: now,
              status: 'running',
              startData: data,
            });
          } else {
            nextId.current += 1;
            const pair: EventPair = {
              id: nextId.current,
              category,
              key,
              attempts: [{ startTime: now, status: 'running', startData: data }],
            };
            map.set(key, pair);
          }
        } else {
          let key: string | undefined;
          if (category === 'step') {
            key = `step-${data.runId}:${data.stepId}`;
          } else if (category === 'poll') {
            key = `poll-${pollCounter.current}`;
          } else {
            key = `drain-${drainCounter.current}`;
          }

          const existing = key ? map.get(key) : undefined;

          if (existing) {
            const attempt = currentAttempt(existing);
            attempt.endTime = now;
            attempt.durationMs = now.getTime() - attempt.startTime.getTime();
            attempt.status = resolveStatus(eventType, data);
            attempt.endData = data;
          } else {
            // Orphan end
            nextId.current += 1;
            const orphan: EventPair = {
              id: nextId.current,
              category,
              key: key || `orphan-${nextId.current}`,
              attempts: [
                {
                  startTime: now,
                  endTime: now,
                  durationMs: (data.durationMs as number) ?? 0,
                  status: resolveStatus(eventType, data),
                  startData: {},
                  endData: data,
                },
              ],
            };
            map.set(orphan.key, orphan);
          }
        }

        // Enforce max size
        const allPairs = [...map.values()].sort((a, b) => a.id - b.id);
        if (allPairs.length > MAX_PAIRS) {
          const toRemove = allPairs.slice(0, allPairs.length - MAX_PAIRS);
          toRemove.forEach(p => map.delete(p.key));
        }

        setPairs([...map.values()].sort((a, b) => a.id - b.id));
      });
    });

    return () => es.close();
  }, []);

  const counters: Counters = {
    running: pairs.filter(p => currentAttempt(p).status === 'running').length,
    awaiting: pairs.filter(p => currentAttempt(p).status === 'awaiting-input').length,
    steps: pairs.filter(p => p.category === 'step' && currentAttempt(p).endTime).length,
    errors: pairs.filter(p => currentAttempt(p).status === 'error').length,
  };

  return { pairs, counters, status, clearEvents };
}
