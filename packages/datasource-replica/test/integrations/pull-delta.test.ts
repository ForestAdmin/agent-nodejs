import type { PullDeltaRequest, PullDeltaResponse, ReplicaDataSourceOptions } from '../../src';

import Croner from 'croner';

import { getAllRecords, makeReplicaDataSource, makeSchemaWithId } from './factories';

describe('pull delta', () => {
  describe('when the schema is not provided', () => {
    it('should list records correctly', async () => {
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: true,
          newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 1, name: 'Simon' } }],
          nextDeltaState: 'delta-state',
          deletedEntries: [],
        })
        .mockResolvedValueOnce({
          more: false,
          newOrUpdatedEntries: [
            { collection: 'contacts', record: { id: 2, name: 'Smith', age: 18 } },
          ],
          deletedEntries: [],
        });

      const datasource = await makeReplicaDataSource({
        pullDeltaHandler,
        pullDeltaOnRestart: true,
        pullDeltaOnBeforeAccess: true,
      });

      expect(await getAllRecords(datasource, 'contacts', ['id', 'name', 'age'])).toEqual([
        { id: 1, name: 'Simon', age: null },
        { id: 2, name: 'Smith', age: 18 },
      ]);
    });
  });

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
        pullDeltaOnRestart: true,
      });

      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);
      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 3 }]);
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
        pullDeltaOnRestart: true,
      });

      expect(pullDeltaHandler).toHaveBeenCalledTimes(3);

      expect(await getAllRecords(datasource, 'contacts')).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);

      // saving previous state at each call
      expect(allDeltaStatesAfterCalls).toEqual([null, 'delta-state1', 'delta-state2']);
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
        pullDeltaOnRestart: true,
      });

      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);

      expect(await getAllRecords(datasource, 'contacts')).toEqual([]);
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
        pullDeltaOnRestart: true,
      });

      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);

      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 3 }]);
    });
  });

  describe('when a record is update', () => {
    it('should execute the delta', async () => {
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce(async () => {
          return {
            more: true,
            newOrUpdatedEntries: [
              { collection: 'contacts', record: { id: 1, details: { name: 'Florian', age: 25 } } },
            ],
            nextDeltaState: 'delta-state',
            deletedEntries: [],
          } as PullDeltaResponse;
        })
        .mockImplementationOnce(async () => {
          return {
            more: true,
            newOrUpdatedEntries: [
              { collection: 'contacts', record: { id: 1, details: { name: 'Florian', age: 25 } } },
            ],
            nextDeltaState: 'delta-state',
            deletedEntries: [],
          } as PullDeltaResponse;
        });

      const schema: ReplicaDataSourceOptions['schema'] = [
        {
          name: 'contacts',
          fields: {
            id: { type: 'Number', isPrimaryKey: true },
            details: {
              name: { type: 'String' },
              age: { type: 'Number' },
            },
          },
        },
      ];

      const datasource = await makeReplicaDataSource({
        pullDeltaHandler,
        schema,
        pullDeltaOnRestart: true,
        flattenOptions: {
          contacts: { asModels: ['details'] },
        },
      });
      expect(pullDeltaHandler).toHaveBeenCalledTimes(3);

      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }]);
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
          pullDeltaOnRestart: true,
        });

        expect(pullDeltaHandler).toHaveBeenCalledTimes(1);

        expect(await getAllRecords(datasource, 'contacts')).toEqual([]);
      });
    });
  });

  describe('when the delta does not respect the schema', () => {
    describe('when the collection name does not exist in the schema', () => {
      it('should log an error', async () => {
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

describe('on schedule', () => {
  it('should add scheduler on handler', async () => {
    const schedulerStop = jest.fn();
    Croner.Cron = jest.fn().mockImplementation((pattern, func) => {
      func();

      return { stop: schedulerStop };
    }) as unknown as typeof Croner.Cron;

    const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
      .fn()
      .mockResolvedValueOnce({
        more: false,
        newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 1 } }],
        nextDeltaState: 'delta-state',
        deletedEntries: [],
      });

    const datasource = await makeReplicaDataSource({
      pullDeltaHandler,
      schema: makeSchemaWithId('contacts'),
      pullDeltaOnSchedule: '* * * * * *',
    });

    expect(await getAllRecords(datasource, 'contacts')).toEqual([]);
    expect(pullDeltaHandler).toHaveBeenCalledTimes(1);

    expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }]);

    await (datasource as unknown as any).childDataSource.options.source.stop();
    expect(schedulerStop).toHaveBeenCalledTimes(1);
  });

  it('should add scheduler with a delay on handler', async () => {
    const schedulerStop = jest.fn();
    let resolveScheduledTask;
    const scheduledTaskExecuted = new Promise(resolve => {
      resolveScheduledTask = resolve;
    });

    jest.spyOn(Croner, 'Cron').mockImplementation((pattern: string | Date, func: any) => {
      func().then(() => resolveScheduledTask());

      return { stop: schedulerStop } as unknown as Croner.Cron;
    });

    const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
      .fn()
      .mockResolvedValueOnce({
        more: false,
        newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 1 } }],
        nextDeltaState: 'delta-state',
        deletedEntries: [],
      });

    const datasource = await makeReplicaDataSource({
      pullDeltaHandler,
      schema: makeSchemaWithId('contacts'),
      pullDeltaOnSchedule: '* * * * * *',
      pullDeltaOnBeforeAccessDelay: 2,
    });

    expect(await getAllRecords(datasource, 'contacts')).toEqual([]);
    expect(pullDeltaHandler).toHaveBeenCalledTimes(0);

    expect(Croner.Cron).toHaveBeenCalledWith('* * * * * *', expect.any(Function));

    await scheduledTaskExecuted;

    expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 1 }]);

    await (datasource as unknown as any).childDataSource.options.source.stop();
    expect(schedulerStop).toHaveBeenCalledTimes(1);
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
