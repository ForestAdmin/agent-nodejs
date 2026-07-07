import type { Metrics } from '../../src/ports/metrics-port';
import type { ForestSchemaAction } from '@forestadmin/forestadmin-client';

import { action, collection, makeMetrics } from './fixtures';
import ActionEndpointResolver, {
  ACTION_ENDPOINT_ERROR,
  ACTION_ENDPOINT_MISS,
} from '../../src/read-model/action-endpoint-resolver';
import SchemaUnavailableError from '../../src/read-model/errors';
import ReadModel from '../../src/read-model/read-model';

function modelWith(actions: ForestSchemaAction[]): ReadModel {
  return new ReadModel([collection('users', [], actions)]);
}

describe('ActionEndpointResolver', () => {
  let metrics: jest.Mocked<Metrics>;

  beforeEach(() => {
    metrics = makeMetrics();
  });

  describe('hit', () => {
    it('should return the endpoint info for a mapped action', async () => {
      const model = modelWith([action('ban', '/forest/users/actions/ban')]);
      const resolver = new ActionEndpointResolver(async () => model, metrics);

      const info = await resolver.resolve('users', 'ban', { rendering: 7 });

      expect(info?.endpoint).toBe('/forest/users/actions/ban');
      expect(metrics.increment).not.toHaveBeenCalled();
    });
  });

  describe('miss', () => {
    it('should emit the miss counter with rendering/collection/action tags and not throw', async () => {
      const model = modelWith([action('ban', '/forest/users/actions/ban')]);
      const resolver = new ActionEndpointResolver(async () => model, metrics);

      const info = await resolver.resolve('users', 'unknown', { rendering: 7 });

      expect(info).toBeUndefined();
      expect(metrics.increment).toHaveBeenCalledWith(ACTION_ENDPOINT_MISS, {
        rendering: 7,
        collection: 'users',
        action: 'unknown',
      });
    });
  });

  describe('error', () => {
    it('should emit the error counter when the read-model provider throws and not throw', async () => {
      const resolver = new ActionEndpointResolver(async () => {
        throw new SchemaUnavailableError();
      }, metrics);

      const info = await resolver.resolve('users', 'ban', { rendering: 7 });

      expect(info).toBeUndefined();
      expect(metrics.increment).toHaveBeenCalledWith(ACTION_ENDPOINT_ERROR, {
        rendering: 7,
        collection: 'users',
        action: 'ban',
      });
    });
  });

  describe('when the metrics backend throws', () => {
    const throwingMetrics: Metrics = {
      increment: () => {
        throw new Error('metrics backend down');
      },
      gauge: jest.fn(),
    };

    it('should still return undefined on a miss (never throws)', async () => {
      const model = modelWith([action('ban', '/forest/users/actions/ban')]);
      const resolver = new ActionEndpointResolver(async () => model, throwingMetrics);

      await expect(resolver.resolve('users', 'unknown', { rendering: 7 })).resolves.toBeUndefined();
    });

    it('should still return undefined on the error path (never throws)', async () => {
      const resolver = new ActionEndpointResolver(async () => {
        throw new SchemaUnavailableError();
      }, throwingMetrics);

      await expect(resolver.resolve('users', 'ban', { rendering: 7 })).resolves.toBeUndefined();
    });
  });
});
