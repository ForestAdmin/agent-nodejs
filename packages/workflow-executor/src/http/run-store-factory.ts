import type { RunStore } from '../ports/run-store';

export interface RunStoreFactory {
  buildRunStore(runId: string): RunStore;
}
