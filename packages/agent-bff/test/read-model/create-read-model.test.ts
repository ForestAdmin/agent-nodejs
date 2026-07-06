import { SchemaService } from '@forestadmin/forestadmin-client';

import { action, collection, column, makeMetrics } from './fixtures';
import { ACTION_ENDPOINT_MISS } from '../../src/read-model/action-endpoint-resolver';
import createReadModel from '../../src/read-model/create-read-model';

jest.mock('@forestadmin/forestadmin-client');

describe('createReadModel', () => {
  const getSchema = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (SchemaService as unknown as jest.Mock).mockImplementation(() => ({ getSchema }));
    getSchema.mockResolvedValue([
      collection('users', [column('id')], [action('ban', '/forest/users/actions/ban')]),
    ]);
  });

  it('should wire a store whose read-model reflects the fetched schema', async () => {
    const { store } = createReadModel({
      forestServerUrl: 'x',
      envSecret: 'y',
      metrics: makeMetrics(),
    });

    const model = await store.getReadModel();

    expect(model.isCollectionAllowed('users')).toBe(true);
    expect(model.isActionAllowed('users', 'ban')).toBe(true);
  });

  it('should wire an action-endpoint resolver that resolves mapped actions', async () => {
    const { actionEndpointResolver } = createReadModel({
      forestServerUrl: 'x',
      envSecret: 'y',
      metrics: makeMetrics(),
    });

    const info = await actionEndpointResolver.resolve('users', 'ban', { rendering: 1 });

    expect(info?.endpoint).toBe('/forest/users/actions/ban');
  });

  it('should wire the provided metrics into the resolver', async () => {
    const metrics = makeMetrics();
    const { actionEndpointResolver } = createReadModel({
      forestServerUrl: 'x',
      envSecret: 'y',
      metrics,
    });

    await actionEndpointResolver.resolve('users', 'missing', { rendering: 3 });

    expect(metrics.increment).toHaveBeenCalledWith(ACTION_ENDPOINT_MISS, {
      rendering: 3,
      collection: 'users',
      action: 'missing',
    });
  });

  it('should route metrics through the console logger when none is provided', async () => {
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    try {
      const { actionEndpointResolver } = createReadModel({ forestServerUrl: 'x', envSecret: 'y' });
      await actionEndpointResolver.resolve('users', 'missing', { rendering: 9 });

      const logged = info.mock.calls.map(call => JSON.parse(call[0] as string));
      expect(logged).toContainEqual(
        expect.objectContaining({
          message: 'metric.increment',
          metric: ACTION_ENDPOINT_MISS,
          rendering: 9,
          collection: 'users',
          action: 'missing',
        }),
      );
    } finally {
      info.mockRestore();
    }
  });
});
