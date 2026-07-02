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

  it('should default to console metrics when none is provided', () => {
    const bundle = createReadModel({ forestServerUrl: 'x', envSecret: 'y' });

    expect(bundle.store).toBeDefined();
    expect(bundle.actionEndpointResolver).toBeDefined();
  });
});
