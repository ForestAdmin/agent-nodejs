import { ConditionTreeLeaf, Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { PullDumpRequest, ReplicaDataSourceOptions, createReplicaDataSource } from '../../src';

describe('pull dump', () => {
  const makeLogger = () => jest.fn();

  const getAllRecords = async (datasource: any) => {
    const allRecordsFilter = new Filter({
      conditionTree: new ConditionTreeLeaf('id', 'Present'),
    });

    return datasource
      .getCollection('contacts')
      .list(factories.caller.build(), allRecordsFilter, new Projection('id'));
  };

  const makeReplicateDataSource = async (options: ReplicaDataSourceOptions) => {
    const replicaFactory = createReplicaDataSource(options);

    return replicaFactory(makeLogger());
  };

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

      const schema: ReplicaDataSourceOptions['schema'] = [
        { name: 'contacts', fields: { id: { type: 'Number', isPrimaryKey: true } } },
      ];

      const datasource = await makeReplicateDataSource({ pullDumpHandler, schema });

      expect(await getAllRecords(datasource)).toEqual([{ id: 1 }, { id: 2 }]);
      expect(pullDumpHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the dump has many iterations', () => {
    it('should insert the records by calling the dump until the more value is false', async () => {
      const allDumpStatesAfterCalls = [];
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockImplementationOnce((request: PullDumpRequest) => {
          allDumpStatesAfterCalls.push(request.previousDumpState);

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
          allDumpStatesAfterCalls.push(request.previousDumpState);

          return {
            more: false, // stop the dump
            entries: [
              { collection: 'contacts', record: { id: 3 } },
              { collection: 'contacts', record: { id: 4 } },
            ],
          };
        });

      const schema: ReplicaDataSourceOptions['schema'] = [
        { name: 'contacts', fields: { id: { type: 'Number', isPrimaryKey: true } } },
      ];

      const datasource = await makeReplicateDataSource({ pullDumpHandler, schema });

      expect(await getAllRecords(datasource)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
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

      const schema: ReplicaDataSourceOptions['schema'] = [
        { name: 'contacts', fields: { id: { type: 'Number', isPrimaryKey: true } } },
      ];

      const datasource = await makeReplicateDataSource({ pullDumpHandler, schema });

      expect(await getAllRecords(datasource)).toEqual([]);
    });
  });

  describe('when the dump does not respect the schema', () => {
    describe('when there is any record expected by the schema', () => {
      it('should throw an error', async () => {
        const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
          .fn()
          .mockImplementationOnce(() => {
            return {
              more: false,
              entries: [{ collection: 'contacts', record: { fieldNotExist: 1 } }],
            };
          });

        const schema: ReplicaDataSourceOptions['schema'] = [
          { name: 'contacts', fields: { id: { type: 'Number', isPrimaryKey: true } } },
        ];

        const datasource = await makeReplicateDataSource({ pullDumpHandler, schema });

        // TODO: fix the code to throw error
        expect(await getAllRecords(datasource)).toEqual([{ id: 1 }]);
      });
    });

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

        const schema: ReplicaDataSourceOptions['schema'] = [
          { name: 'contacts', fields: { id: { type: 'Number', isPrimaryKey: true } } },
        ];

        const datasource = await makeReplicateDataSource({ pullDumpHandler, schema });

        // TODO: fix the code to display a warning log
        expect(await getAllRecords(datasource)).toEqual([{ id: 1 }]);
        expect(pullDumpHandler).toHaveBeenCalledTimes(1);
      });
    });
  });
});
