import type { PullDumpRequest, ReplicaDataSourceOptions } from '../../src';

import Croner from 'croner';

import { getAllRecords, makeReplicaDataSource, makeSchemaWithId } from './factories';

describe('pull dump', () => {
  describe('when the dump fails', () => {
    it('should log a warning', async () => {
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('Dump failed');
        });

      const logger = jest.fn();

      await makeReplicaDataSource(
        {
          pullDumpHandler,
          schema: makeSchemaWithId('contacts'),
        },
        logger,
      );

      const [errorEntries] = logger.mock.calls.filter(entry => entry[0] === 'Warn');

      expect(errorEntries).toEqual(['Warn', 'Dump failed for the namespace "forest": Dump failed']);
    });
  });

  describe('when the dump is finished', () => {
    it('should insert the records by calling the dump only one time', async () => {
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: false,
          entries: [
            { collection: 'contacts', record: { id: 1 } },
            { collection: 'contacts', record: { id: 2 } },
          ],
        });

      const datasource = await makeReplicaDataSource({
        pullDumpHandler,
        schema: makeSchemaWithId('contacts'),
      });

      expect(pullDumpHandler).toHaveBeenCalledTimes(1);
      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }, { id: 2 }]);
    });
  });

  describe('when the dump has many iterations', () => {
    it('should insert the records by calling the dump until the more value is false', async () => {
      const allDumpStatesAfterCalls = [];
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockImplementationOnce((request: PullDumpRequest) => {
          allDumpStatesAfterCalls.push(request.previousDumpState as never);

          return {
            more: true,
            entries: [
              { collection: 'contacts', record: { id: 1 } },
              { collection: 'contacts', record: { id: 2 } },
            ],
            nextDumpState: 'theNextDumpState-0',
          };
        })
        .mockImplementationOnce((request: PullDumpRequest) => {
          allDumpStatesAfterCalls.push(request.previousDumpState as never);

          return {
            more: false,
            entries: [
              { collection: 'contacts', record: { id: 3 } },
              { collection: 'contacts', record: { id: 4 } },
            ],
          };
        });

      const datasource = await makeReplicaDataSource({
        pullDumpHandler,
        schema: makeSchemaWithId('contacts'),
      });

      expect(pullDumpHandler).toHaveBeenCalledTimes(2);

      expect(await getAllRecords(datasource, 'contacts')).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
      ]);

      // saving previous state at each call
      expect(allDumpStatesAfterCalls).toEqual([null, 'theNextDumpState-0']);
    });
  });

  describe('when the dump is empty', () => {
    it('does an iteration without throwing error', async () => {
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockImplementationOnce(() => {
          return {
            more: false,
            entries: [],
          };
        });

      const datasource = makeReplicaDataSource({
        pullDumpHandler,
        schema: makeSchemaWithId('contacts'),
      });

      await expect(datasource).resolves.not.toThrow();

      expect(pullDumpHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('on schedule', () => {
    it('should add scheduler on handler', async () => {
      const schedulerStop = jest.fn();
      Croner.Cron = jest.fn().mockImplementation((pattern, func) => {
        func();

        return { stop: schedulerStop };
      }) as unknown as typeof Croner.Cron;

      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockImplementationOnce(() => {
          return {
            more: false,
            entries: [],
          };
        })
        .mockImplementationOnce(() => {
          return {
            more: false,
            entries: [{ collection: 'contacts', record: { id: 1 } }],
          };
        });

      const datasource = await makeReplicaDataSource({
        pullDumpHandler,
        schema: makeSchemaWithId('contacts'),
        pullDumpOnSchedule: '* * * * * *',
      });

      // Trigger the pullDumpHandler to allow the schedule to be executed before next call
      expect(await getAllRecords(datasource, 'contacts')).toEqual([]);
      expect(pullDumpHandler).toHaveBeenCalledTimes(2);
      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }]);

      await (datasource as unknown as any).childDataSource.options.source.stop();
      expect(schedulerStop).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the dump does not respect the schema', () => {
    describe('when the collection name does not exist in the schema', () => {
      it('should log an error', async () => {
        const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
          .fn()
          .mockResolvedValueOnce({
            more: false,
            entries: [{ collection: 'NotExist', record: { id: 1 } }],
          });

        const logger = jest.fn();

        await makeReplicaDataSource(
          {
            pullDumpHandler,
            schema: makeSchemaWithId('contacts'),
          },
          logger,
        );

        const errorEntries = logger.mock.calls.filter(entry => entry[0] === 'Error');

        expect(errorEntries.toString()).toContain("Collection 'NotExist' not found in schema");
      });
    });
  });
});
