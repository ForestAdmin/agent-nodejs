import Croner from 'croner';

import { getAllRecords, makeReplicaDataSource, makeSchemaWithId } from './factories';
import { PullDumpRequest, ReplicaDataSourceOptions } from '../../src';

describe('pull dump', () => {
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

      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }, { id: 2 }]);
      expect(pullDumpHandler).toHaveBeenCalledTimes(1);
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
              { collection: 'contacts', record: { id: 3 } },
              { collection: 'contacts', record: { id: 4 } },
            ],
            nextDumpState: 'theNextDumpState-0',
          };
        })
        .mockImplementationOnce((request: PullDumpRequest) => {
          allDumpStatesAfterCalls.push(request.previousDumpState as never);

          return {
            more: false, // stop the dump
            entries: [
              { collection: 'contacts', record: { id: 1 } },
              { collection: 'contacts', record: { id: 2 } },
            ],
          };
        });

      const datasource = await makeReplicaDataSource({
        pullDumpHandler,
        schema: makeSchemaWithId('contacts'),
      });

      expect(await getAllRecords(datasource, 'contacts')).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
      ]);
      expect(pullDumpHandler).toHaveBeenCalledTimes(2);

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

      const datasource = await makeReplicaDataSource({
        pullDumpHandler,
        schema: makeSchemaWithId('contacts'),
      });

      expect(await getAllRecords(datasource, 'contacts')).toEqual([]);
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

      expect(await getAllRecords(datasource, 'contacts')).toEqual([]);
      expect(pullDumpHandler).toHaveBeenCalledTimes(2);
      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }]);

      // @ts-ignore
      await datasource.childDataSource.options.source.stop();
      expect(schedulerStop).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the dump does not respect the schema', () => {
    // describe('when there is any record expected by the schema', () => {
    //   it('should throw an error', async () => {
    //     const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
    //       .fn()
    //       .mockImplementationOnce(() => {
    //         return {
    //           more: false,
    //           entries: [{ collection: 'contacts', record: { fieldNotExist: 1 } }],
    //         };
    //       });

    //     const datasource = await makeReplicaDataSource({
    //       pullDumpHandler,
    //       schema: makeSchemaWithId('contacts'),
    //     });

    //     // TODO: fix the code to throw error
    //     expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }]);
    //   });
    // });

    describe('when there is any field expected by the schema', () => {
      it('should insert the records and display a warning log', async () => {
        const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
          .fn()
          .mockImplementationOnce(() => {
            return {
              more: false,
              entries: [{ collection: 'contacts', record: { id: 1, fieldNotExist: 1 } }],
            };
          });

        const datasource = await makeReplicaDataSource({
          pullDumpHandler,
          schema: makeSchemaWithId('contacts'),
        });

        // TODO: fix the code to display a warning log
        expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }]);
        expect(pullDumpHandler).toHaveBeenCalledTimes(1);
      });
    });

    // describe('when the collection name does not exist in the schema', () => {
    //   it('should error log or an error', async () => {
    //     const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
    //       .fn()
    //       .mockImplementationOnce(() => {
    //         return {
    //           more: false,
    //           entries: [{ collection: 'NotExist', record: { id: 1 } }],
    //         };
    //       });

    //     const datasource = await makeReplicaDataSource({
    //       pullDumpHandler,
    //       schema: makeSchemaWithId('contacts'),
    //     });

    //     // TODO: fix the code to display a error log or an error ?
    //     expect('false').toEqual(true);
    //   });
    // });
  });
});
