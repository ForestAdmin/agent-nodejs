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

  // TODO: debug this test
  describe('when the delta has many iterations', () => {
    it('should call the delta until the more value is false', async () => {
      const allDeltaStatesAfterCalls = [];
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce(async (request: PullDeltaRequest) => {
          allDeltaStatesAfterCalls.push(request.previousDeltaState);

          return {
            more: true,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 1 } }],
            nextDeltaState: 'delta-state1',
            deletedEntries: [],
          };
        })
        .mockImplementationOnce(async (request: PullDeltaRequest) => {
          allDeltaStatesAfterCalls.push(request.previousDeltaState);

          return {
            more: true,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 2 } }],
            nextDeltaState: 'delta-state2',
            deletedEntries: [],
          };
        })
        .mockImplementationOnce(async (request: PullDeltaRequest) => {
          allDeltaStatesAfterCalls.push(request.previousDeltaState);

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

  // TODO: add the tests on the push
  // TODO: check if it works without the deleted entries attribute if it throw an error

  // TODO: check number of delta handler calls
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

  // TODO: CHECK IF THIS CODE THROW AN ERROR LIKE THE DUMP
  describe('when the delta does not respect the schema', () => {
    // describe('when there is any record expected by the schema', () => {
    //   it('should throw an error', async () => {
    //     const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
    //       .fn()
    //       .mockImplementationOnce(() => {
    //         return {
    //           more: false,
    // eslint-disable-next-line max-len
    //           newOrUpdatedEntries: [{ collection: 'contacts', record: { CollectionNotExist: 1 } }],
    //           nextDeltaState: 'delta-state',
    //           deletedEntries: [],
    //         } as PullDeltaResponse;
    //       });

    //     const datasource = await makeReplicaDataSource({
    //       pullDeltaHandler,
    //       schema: makeSchemaWithId('contacts'),
    //       pullDeltaOnBeforeAccess: true,
    //     });

    //     // TODO: fix the code to throw error
    //     expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }]);
    //   });
    // });

    // TODO: CHECK IF THIS CODE THROW AN ERROR
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

        const datasource = await makeReplicaDataSource({
          pullDeltaHandler,
          schema: makeSchemaWithId('contacts'),
          pullDeltaOnBeforeAccess: true,
        });

        expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }]);
      });
    });

    // eslint-disable-next-line jest/no-commented-out-tests
    // describe('when the collection name does not exist in the schema', () => {
    // eslint-disable-next-line jest/no-commented-out-tests
    //   it('should error log or an error', async () => {
    //     const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
    //       .fn()
    //       .mockImplementationOnce(() => {
    //         return {
    //           more: false,
    //           newOrUpdatedEntries: [{ collection: 'notExist', record: { id: 1 } }],
    //           nextDeltaState: 'delta-state',
    //           deletedEntries: [],
    //         } as PullDeltaResponse;
    //       });

    //     // const datasource = await makeReplicaDataSource({
    //     //   pullDeltaHandler,
    //     //   schema: makeSchemaWithId('contacts'),
    //     //   pullDeltaOnBeforeAccess: true,
    //     // });

    //     // TODO: fix the code to display a error log or an error ?
    //     expect('false').toEqual(true);
    //   });
    // });
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
