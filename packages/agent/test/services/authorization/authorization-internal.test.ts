import { Aggregation, GenericTree } from '@forestadmin/datasource-toolkit';

import * as factories from '../../__factories__';

import {
  canPerformConditionalCustomAction,
  intersectCount,
  transformToRolesIdsGroupByConditions,
} from '../../../src/services/authorization/authorization-internal';
import InvalidActionConditionError from '../../../src/services/authorization/errors/invalidActionConditionError';

describe('AuthorizationService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('intersectCount', () => {
    describe('when conditionalRawCondition is undefined', () => {
      it('should compute the requestConditionTree aggregate count on the collection', async () => {
        const caller = factories.caller.build();
        const collection = factories.collection.build({ name: 'actors' });
        const requestConditionTree = factories.conditionTreeLeaf.build();

        (collection.aggregate as jest.Mock).mockResolvedValue([{ value: 16 }]);

        await expect(intersectCount(caller, collection, requestConditionTree)).resolves.toBe(16);

        expect(collection.aggregate).toHaveBeenCalledWith(
          caller,
          {
            conditionTree: { field: 'a field', operator: 'Present', value: undefined },
            search: undefined,
            searchExtended: undefined,
            segment: undefined,
          },
          new Aggregation({
            operation: 'Count',
          }),
        );
      });
    });

    describe('when conditionalRawCondition is defined', () => {
      it(
        'should compute the aggregate count intersection of requestConditionTree' +
          ' and conditionalRawCondition on the collection',
        async () => {
          const caller = factories.caller.build();
          const collection = factories.collection.build({
            name: 'actors',
            schema: {
              fields: { myField: factories.columnSchema.build() },
            },
          });
          const requestConditionTree = factories.conditionTreeLeaf.build();
          const conditionalRawCondition = {
            value: 'some',
            field: 'myField',
            operator: 'equal',
          } as unknown;

          (collection.aggregate as jest.Mock).mockResolvedValue([{ value: 16 }]);

          await expect(
            intersectCount(caller, collection, requestConditionTree, conditionalRawCondition),
          ).resolves.toBe(16);

          expect(collection.aggregate).toHaveBeenCalledWith(
            caller,
            {
              conditionTree: {
                aggregator: 'And',
                conditions: [
                  { field: 'myField', operator: 'Equal', value: 'some' },
                  { field: 'a field', operator: 'Present', value: undefined },
                ],
              },
              search: undefined,
              searchExtended: undefined,
              segment: undefined,
            },
            new Aggregation({
              operation: 'Count',
            }),
          );
        },
      );
    });

    it('should throw InvalidActionConditionError when something occurs', async () => {
      const caller = factories.caller.build();
      const collection = factories.collection.build({ name: 'actors' });
      const requestConditionTree = factories.conditionTreeLeaf.build();

      (collection.aggregate as jest.Mock).mockRejectedValue(new Error());

      await expect(intersectCount(caller, collection, requestConditionTree)).rejects.toThrow(
        InvalidActionConditionError,
      );
    });
  });

  describe('canPerformConditionalCustomAction', () => {
    it('should return true when both intersectCount return the same value', async () => {
      const caller = factories.caller.build();
      const collection = factories.collection.build({
        name: 'actors',
        schema: {
          fields: { definition: factories.columnSchema.build() },
        },
      });

      const requestConditionTree = factories.conditionTreeLeaf.build();
      const conditionalRawCondition = {
        value: 'some',
        field: 'definition',
        operator: 'Equal',
      };

      (collection.aggregate as jest.Mock).mockResolvedValue([{ value: 16 }]);

      const result = await canPerformConditionalCustomAction(
        caller,
        collection,
        requestConditionTree,
        conditionalRawCondition,
      );

      expect(result).toBe(true);
    });

    it('should return true when conditionalRawCondition is null', async () => {
      const caller = factories.caller.build();
      const collection = factories.collection.build({ name: 'actors' });
      const requestConditionTree = factories.conditionTreeLeaf.build();

      const result = await canPerformConditionalCustomAction(
        caller,
        collection,
        requestConditionTree,
        null,
      );

      expect(result).toBe(true);
    });

    it('should return false otherwise', async () => {
      const caller = factories.caller.build();
      const collection = factories.collection.build({
        name: 'actors',
        schema: {
          fields: { definition: factories.columnSchema.build() },
        },
      });
      const requestConditionTree = factories.conditionTreeLeaf.build();

      const conditionalRawCondition = {
        value: 'some',
        field: 'definition',
        operator: 'Equal',
      };

      (collection.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ value: 16 }])
        .mockResolvedValueOnce([{ value: 2 }]);

      const result = await canPerformConditionalCustomAction(
        caller,
        collection,
        requestConditionTree,
        conditionalRawCondition,
      );

      expect(result).toBe(false);
    });
  });

  describe('transformToRolesIdsGroupByConditions', () => {
    it('should return rolesIds group by conditions', () => {
      const condition = {
        value: 'some',
        field: 'definition',
        operator: 'Equal',
      } as GenericTree;

      const otherCondition = {
        value: 10,
        field: 'foo',
        operator: 'LessThan',
      } as GenericTree;

      const fakeActionConditionsByRoleId = new Map<number, GenericTree>([
        [1, condition],
        [2, condition],
        [3, otherCondition],
      ]);

      const result = transformToRolesIdsGroupByConditions(fakeActionConditionsByRoleId);

      expect(result).toEqual([
        {
          roleIds: [1, 2],
          condition,
        },
        {
          roleIds: [3],
          condition: otherCondition,
        },
      ]);
    });
  });

  it('should return empty array on empty map', () => {
    const fakeActionConditionsByRoleId = new Map<number, GenericTree>();

    const result = transformToRolesIdsGroupByConditions(fakeActionConditionsByRoleId);

    expect(result).toEqual([]);
  });
});
