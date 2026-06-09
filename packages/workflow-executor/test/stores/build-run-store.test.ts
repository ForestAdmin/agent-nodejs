import { buildDatabaseRunStore, buildInMemoryRunStore } from '../../src/stores/build-run-store';
import InMemoryStore from '../../src/stores/in-memory-store';

describe('buildInMemoryRunStore', () => {
  it('returns an initialized InMemoryStore', async () => {
    const store = await buildInMemoryRunStore();

    expect(store).toBeInstanceOf(InMemoryStore);
    // Verify it works
    await store.saveStepExecution('run-1', {
      type: 'condition',
      stepIndex: 0,
      executionParams: { answer: 'yes' },
    } as never);
    const result = await store.getStepExecutions('run-1');
    expect(result).toHaveLength(1);
  });
});

describe('buildDatabaseRunStore', () => {
  it('returns an initialized DatabaseStore (SQLite)', async () => {
    const store = await buildDatabaseRunStore({ dialect: 'sqlite', storage: ':memory:' });

    // Verify it works (migration ran)
    await store.saveStepExecution('run-1', {
      type: 'condition',
      stepIndex: 0,
      executionParams: { answer: 'yes' },
    } as never);
    const result = await store.getStepExecutions('run-1');
    expect(result).toHaveLength(1);

    await store.close();
  });

  it('closes sequelize connection if init fails', async () => {
    // Invalid storage path to force a failure
    await expect(
      buildDatabaseRunStore({ dialect: 'sqlite', storage: '/nonexistent/path/db.sqlite' }),
    ).rejects.toThrow();
  });
});
