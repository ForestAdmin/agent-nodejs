import { Sequelize } from 'sequelize';

import AnalysisPassThough from '../../src/synchronization/analysis-passthrough';
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

  describe('When the agent is already strated', () => {
    it('should throw an error', async () => {
      const target: SynchronizationTarget = {
        applyDump: jest.fn(),
        applyDelta: jest.fn(),
      };

      analysisPassThrough.target = target;
      await expect(analysisPassThrough.start(target)).rejects.toThrow('Already started');
    });
  });

  describe('When the queuePullDump is called', () => {
    it('should call the synchronizeSource queuePullDump', async () => {
      const reason: any = jest.fn();

      analysisPassThrough.queuePullDump(reason);

      const spy = jest.spyOn(mockSource, 'queuePullDump');

      await expect(spy).toHaveBeenCalledWith(reason);
    });
  });

  describe('When the queuePullDelta is called', () => {
    it('should call the synchronizeSource queuePullDelta', async () => {
      const reason: any = jest.fn();

      analysisPassThrough.queuePullDelta(reason);

      const spy = jest.spyOn(mockSource, 'queuePullDelta');

      await expect(spy).toHaveBeenCalledWith(reason);
    });
  });

  describe('When the requestCache id getted', () => {
    it('should get the synchronizeSource requestCache', async () => {
      await expect(analysisPassThrough.requestCache).toEqual(mockSource.requestCache);
    });
  });

  describe('When a dump is applied', () => {
    it('should call the target applyDump method', async () => {
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

      const spy = jest.spyOn(target, 'applyDump');

      analysisPassThrough.applyDump(changes, true);

      expect(spy).toHaveBeenCalledWith(changes, true);
    });
  });

  describe('When a delta is applied', () => {
    it('should apply the target applyDelta', async () => {
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
      const spy = jest.spyOn(target, 'applyDelta');

      analysisPassThrough.applyDelta(changes);

      expect(spy).toHaveBeenCalledWith(changes);
    });
  });
});
