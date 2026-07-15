import type ReadModelStore from '../../src/read-model/read-model-store';

import { resolveReadModel } from '../../src/http/agent-route-helpers';
import SchemaUnavailableError from '../../src/read-model/errors';

function storeThrowing(error: unknown): ReadModelStore {
  return {
    getReadModel: async () => {
      throw error;
    },
  } as unknown as ReadModelStore;
}

describe('resolveReadModel', () => {
  it('maps a SchemaUnavailableError to a 503 schema_unavailable error', async () => {
    await expect(
      resolveReadModel(storeThrowing(new SchemaUnavailableError())),
    ).rejects.toMatchObject({ status: 503, type: 'schema_unavailable' });
  });

  it('rethrows a non-schema error unchanged', async () => {
    const boom = new Error('boom');

    await expect(resolveReadModel(storeThrowing(boom))).rejects.toBe(boom);
  });
});
