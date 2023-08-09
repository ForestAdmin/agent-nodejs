import { Sequelize } from 'sequelize';

import AnalysisPassThough from '../../src/synchronization/analysis-passthrough'; // Import the class you want to test
import {
  PullDeltaResponse,
  PullDumpResponse,
  SynchronizationSource,
  SynchronizationTarget,
} from '../../src/types';

class MockSequelizeConnection {
  model() {
    return {
      connection: jest.fn(),
    };
  }
}
describe('AnalysisPassThough', () => {
  let analysisPassThrough: AnalysisPassThough;
  const mockSource: SynchronizationSource = {
    queuePullDump: jest.fn(),
    queuePullDelta: jest.fn(),
    start: jest.fn(),
    requestCache: undefined as any,
  };

  beforeEach(() => {
    const mockSequelizeConnection = new MockSequelizeConnection();

    analysisPassThrough = new AnalysisPassThough(
      mockSequelizeConnection as unknown as Sequelize,
      mockSource,
      'testNamespace',
    );
  });

  it('Should throw if the agent is already started', async () => {
    const target: SynchronizationTarget = {
      applyDump: jest.fn(),
      applyDelta: jest.fn(),
    };

    analysisPassThrough.target = target;
    await expect(analysisPassThrough.start(target)).rejects.toThrow();
  });

  it('Should call the source queuePullDump', async () => {
    const reason: any = jest.fn();

    analysisPassThrough.queuePullDump(reason);

    const spy = jest.spyOn(mockSource, 'queuePullDump');

    await expect(spy).toHaveBeenCalledWith(reason);
  });

  it('Should call the source queuePullDelta', async () => {
    const reason: any = jest.fn();

    analysisPassThrough.queuePullDelta(reason);

    const spy = jest.spyOn(mockSource, 'queuePullDelta');

    await expect(spy).toHaveBeenCalledWith(reason);
  });

  it('Should call the source requestCache', async () => {
    await expect(analysisPassThrough.requestCache).toEqual(mockSource.requestCache);
  });

  it('Should apply the target dump on dump', async () => {
    const target: SynchronizationTarget = {
      applyDump: jest.fn(),
      applyDelta: jest.fn(),
    };

    const changes: PullDumpResponse = {
      more: false,
      entries: [],
      nextDeltaState: null,
    };

    analysisPassThrough.target = target;
    analysisPassThrough.applyDump(changes, true);

    const spy = jest.spyOn(target, 'applyDump');

    await expect(spy).toHaveBeenCalledWith(changes, true);
  });

  it('Should apply the target delta on delta', async () => {
    const target: SynchronizationTarget = {
      applyDump: jest.fn(),
      applyDelta: jest.fn(),
    };

    const changes: PullDeltaResponse = {
      more: false,
      nextDeltaState: null,
      newOrUpdatedEntries: [],
      deletedEntries: [],
    };

    analysisPassThrough.target = target;
    analysisPassThrough.applyDelta(changes);

    const spy = jest.spyOn(target, 'applyDelta');

    await expect(spy).toHaveBeenCalledWith(changes);
  });
});
