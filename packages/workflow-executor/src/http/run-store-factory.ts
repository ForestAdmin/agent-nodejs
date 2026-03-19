import type { RunStore } from '../ports/run-store';

export interface RunStoreFactory {
  getRunStore(runId: string): RunStore | null;
}
