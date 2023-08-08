import { getAllRecords, makeReplicaDataSource, makeSchemaWithId } from './factories';
import { PullDeltaRequest, PullDeltaResponse, ReplicaDataSourceOptions } from '../../src';

describe('pull delta', () => {
  describe('when the delta is finished', () => {
    it('should insert the records by calling the delta only one time', async () => {
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: false,
          newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 3 } }],
          nextDeltaState: 'delta-state',
          deletedEntries: [],
        });

      const datasource = await makeReplicaDataSource({
        pullDeltaHandler,
        schema: makeSchemaWithId('contacts'),
        pullDeltaOnBeforeAccess: true,
      });

      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 3 }]);
      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the delta has many iterations', () => {
    it('should call the delta until the more value is false', async () => {
      const allDeltaStatesAfterCalls = [];
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce(async (request: PullDeltaRequest) => {
          allDeltaStatesAfterCalls.push(request.previousDeltaState as never);

          return {
            more: true,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 1 } }],
            nextDeltaState: 'delta-state1',
            deletedEntries: [],
          };
        })
        .mockImplementationOnce(async (request: PullDeltaRequest) => {
          allDeltaStatesAfterCalls.push(request.previousDeltaState as never);

          return {
            more: true,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 2 } }],
            nextDeltaState: 'delta-state2',
            deletedEntries: [],
          };
        })
        .mockImplementationOnce(async (request: PullDeltaRequest) => {
          allDeltaStatesAfterCalls.push(request.previousDeltaState as never);

          return {
            more: false,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 3 } }],
            nextDeltaState: 'delta-state3',
            deletedEntries: [],
          };
        });

      const datasource = await makeReplicaDataSource({
        pullDeltaHandler,
        schema: makeSchemaWithId('contacts'),
        pullDeltaOnBeforeAccess: true,
      });

      expect(await getAllRecords(datasource, 'contacts')).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);

      // saving previous state at each call
      expect(allDeltaStatesAfterCalls).toEqual([null, 'delta-state1', 'delta-state2']);
      expect(pullDeltaHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe('when the delta is empty', () => {
    it('does an iteration without throwing error', async () => {
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce(() => {
          return {
            more: false,
            newOrUpdatedEntries: [],
            deletedEntries: [],
          };
        });

      const datasource = await makeReplicaDataSource({
        pullDeltaHandler,
        schema: makeSchemaWithId('contacts'),
        pullDeltaOnBeforeAccess: true,
      });

      expect(await getAllRecords(datasource, 'contacts')).toEqual([]);
      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a record is create', () => {
    it('should execute the delta', async () => {
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce(async () => {
          return {
            more: false,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 3 } }],
            nextDeltaState: 'delta-state',
            deletedEntries: [],
          } as PullDeltaResponse;
        });
      const datasource = await makeReplicaDataSource({
        pullDeltaHandler,
        schema: makeSchemaWithId('contacts'),
        pullDeltaOnBeforeAccess: true,
      });

      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 3 }]);
      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a record is update', () => {
    it('should execute the delta', async () => {
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce(async () => {
          return {
            more: true,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 1 } }],
            nextDeltaState: 'delta-state',
            deletedEntries: [],
          } as PullDeltaResponse;
        })
        .mockImplementationOnce(async () => {
          return {
            more: true,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 1 } }],
            nextDeltaState: 'delta-state',
            deletedEntries: [],
          } as PullDeltaResponse;
        });

      const datasource = await makeReplicaDataSource({
        pullDeltaHandler,
        schema: makeSchemaWithId('contacts'),
        pullDeltaOnBeforeAccess: true,
      });

      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }]);
      expect(pullDeltaHandler).toHaveBeenCalledTimes(3);
    });

    describe('when a record is deleted', () => {
      it('should execute the delta', async () => {
        const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
          .fn()
          .mockImplementationOnce(async () => {
            return {
              more: false,
              newOrUpdatedEntries: [],
              nextDeltaState: 'delta-state',
              deletedEntries: [{ collection: 'contacts', record: { id: 1 } }],
            } as PullDeltaResponse;
          });

        const datasource = await makeReplicaDataSource({
          pullDeltaHandler,
          schema: makeSchemaWithId('contacts'),
          pullDeltaOnBeforeAccess: true,
        });

        expect(await getAllRecords(datasource, 'contacts')).toEqual([]);
        expect(pullDeltaHandler).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('when the delta does not respect the schema', () => {
    describe('when there is any record expected by the schema', () => {
      it('should throw an error', async () => {
        const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
          .fn()
          .mockImplementationOnce(() => {
            return {
              more: false,
              newOrUpdatedEntries: [{ collection: 'contacts', record: { fieldNotExist: 1 } }],
              nextDeltaState: 'delta-state',
              deletedEntries: [],
            } as PullDeltaResponse;
          });

        const logger = jest.fn();

        const datasource = await makeReplicaDataSource(
          {
            pullDeltaHandler,
            schema: makeSchemaWithId('contacts'),
            pullDeltaOnBeforeAccess: true,
          },
          logger,
        );

        expect(await getAllRecords(datasource, 'contacts')).toEqual([]);

        const errorEntries = logger.mock.calls.filter(entry => entry[0] === 'Error');

        expect(errorEntries.toString()).toContain(
          'Cannot find any field in the given records matching the schema of collection "contacts"',
        );
      });
    });

    describe('when there is any field expected by the schema', () => {
      it('should insert the records and display a warning log', async () => {
        const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
          .fn()
          .mockImplementationOnce(() => {
            return {
              more: false,
              newOrUpdatedEntries: [
                { collection: 'contacts', record: { id: 1, fieldNotExist: 1 } },
              ],
              nextDeltaState: 'delta-state',
              deletedEntries: [],
            } as PullDeltaResponse;
          });

        const logger = jest.fn();

        const datasource = await makeReplicaDataSource(
          {
            pullDeltaHandler,
            schema: makeSchemaWithId('contacts'),
            pullDeltaOnBeforeAccess: true,
          },
          logger,
        );

        expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }]);

        const warnEntries = logger.mock.calls.filter(entry => entry[0] === 'Warn');

        expect(warnEntries.toString()).toContain(
          "Fields 'fieldNotExist' do not exist in the schema for collection contacts",
        );
      });
    });

    describe('when the collection name does not exist in the schema', () => {
      it('should error log or an error', async () => {
        const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
          .fn()
          .mockImplementationOnce(() => {
            return {
              more: false,
              newOrUpdatedEntries: [{ collection: 'notExist', record: { id: 1 } }],
              nextDeltaState: 'delta-state',
              deletedEntries: [],
            } as PullDeltaResponse;
          });

        const logger = jest.fn();

        const datasource = await makeReplicaDataSource(
          {
            pullDeltaHandler,
            schema: makeSchemaWithId('contacts'),
            pullDeltaOnBeforeAccess: true,
          },
          logger,
        );

        expect(await getAllRecords(datasource, 'contacts')).toEqual([]);

        const errorEntries = logger.mock.calls.filter(entry => entry[0] === 'Error');

        expect(errorEntries.toString()).toContain("Collection 'notExist' not found in schema");
      });
    });
  });
});

describe('on initialization', () => {
  describe('when handler is defined and no delta flag', () => {
    it('should throw an error', async () => {
      await expect(() =>
        makeReplicaDataSource({
          pullDeltaHandler: (() => {}) as unknown as ReplicaDataSourceOptions['pullDeltaHandler'],
          schema: makeSchemaWithId('contacts'),
        }),
      ).rejects.toThrow('Using pullDeltaHandler without pullDelta[*] flags');
    });
  });

  describe('when flag is defined and no handler', () => {
    it('should throw an error', async () => {
      await expect(() =>
        makeReplicaDataSource({
          pullDeltaOnBeforeAccess: true,
          schema: makeSchemaWithId('contacts'),
        }),
      ).rejects.toThrow('Using pullDelta[*] flags without pullDeltaHandler');
    });
  });
});

// eslint-disable-next-line jest/no-commented-out-tests
//     describe('when before list', () => {
// eslint-disable-next-line jest/no-commented-out-tests
//       it('should execute the delta', async () => {});
//     });

// eslint-disable-next-line jest/no-commented-out-tests
//     describe('when before aggregate', () => {
// eslint-disable-next-line jest/no-commented-out-tests
//       it('should execute the delta', async () => {});
//     });
