import type { ActivityLogsServiceInterface } from '@forestadmin/forestadmin-client';

import ForestadminClientActivityLogPort from '../../src/adapters/forestadmin-client-activity-log-port';
import ForestadminClientActivityLogPortFactory from '../../src/adapters/forestadmin-client-activity-log-port-factory';

function makeLogger() {
  return { info: jest.fn(), error: jest.fn() };
}

function makeService(): jest.Mocked<ActivityLogsServiceInterface> {
  return {
    createActivityLog: jest.fn().mockResolvedValue({ id: 'log-1', attributes: { index: '0' } }),
    updateActivityLogStatus: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ForestadminClientActivityLogPortFactory', () => {
  it('forRun() returns a ForestadminClientActivityLogPort instance bound to the given token', async () => {
    const service = makeService();
    const factory = new ForestadminClientActivityLogPortFactory(service, makeLogger());

    const port = factory.forRun('token-42');
    await port.createPending({ renderingId: 1, action: 'update', type: 'write' });

    expect(port).toBeInstanceOf(ForestadminClientActivityLogPort);
    expect(service.createActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ forestServerToken: 'token-42' }),
    );
  });

  it('shares a single drainer across every port instance it produces', async () => {
    const service = makeService();
    const factory = new ForestadminClientActivityLogPortFactory(service, makeLogger());

    const portA = factory.forRun('token-a');
    const portB = factory.forRun('token-b');

    const handle = { id: 'log-1', index: '0' };
    const pendingA = portA.markSucceeded(handle);
    const pendingB = portB.markSucceeded(handle);

    // drain() must wait for BOTH ports' in-flight transitions.
    await factory.drain();
    await pendingA;
    await pendingB;

    expect(service.updateActivityLogStatus).toHaveBeenCalledTimes(2);
  });

  it('drain() resolves immediately when no ports have in-flight transitions', async () => {
    const factory = new ForestadminClientActivityLogPortFactory(makeService(), makeLogger());

    await expect(factory.drain()).resolves.toBeUndefined();
  });
});
