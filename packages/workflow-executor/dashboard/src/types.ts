export type ConnectionStatus = 'connected' | 'reconnecting' | 'error';

export type EventCategory = 'poll' | 'step' | 'drain';

export type PairStatus = 'running' | 'success' | 'error' | 'awaiting-input';

export interface PairAttempt {
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: PairStatus;
  startData: Record<string, unknown>;
  endData?: Record<string, unknown>;
}

export interface EventPair {
  id: number;
  category: EventCategory;
  key: string;
  attempts: PairAttempt[];
}

export interface Counters {
  running: number;
  awaiting: number;
  steps: number;
  errors: number;
}

export type StatusFilters = Record<PairStatus, boolean>;

export type Filters = Record<EventCategory, boolean>;
