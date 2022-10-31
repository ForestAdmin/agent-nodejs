import hashObject from 'object-hash';

import {
  Aggregation,
  Caller,
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  Filter,
  GenericTree,
} from '@forestadmin/datasource-toolkit';
import ConditionTreeParser from '../../utils/condition-tree-parser';
import InvalidActionConditionError from './errors/invalidActionConditionError';

export async function intersectCount(
  caller: Caller,
  collection: Collection,
  requestConditionTree: ConditionTree,
  conditionalRawCondition?: GenericTree,
) {
  try {
    // Build filter format with the right format
    const conditionalFilter = new Filter({
      conditionTree: conditionalRawCondition
        ? ConditionTreeFactory.intersect(
            ConditionTreeParser.fromPlainObject(collection, conditionalRawCondition),
            requestConditionTree,
          )
        : requestConditionTree,
    });

    const rows = await collection.aggregate(
      caller,
      conditionalFilter,
      new Aggregation({
        operation: 'Count',
      }),
    );

    return (rows?.[0]?.value as number) ?? 0;
  } catch (error) {
    throw new InvalidActionConditionError();
  }
}

export async function canPerformConditionalCustomAction(
  caller: Caller,
  collection: Collection,
  requestConditionTree: ConditionTree,
  conditionalRawCondition: GenericTree,
) {
  if (conditionalRawCondition) {
    const [requestRecordsCount, matchingRecordsCount] = await Promise.all([
      intersectCount(caller, collection, requestConditionTree),
      intersectCount(caller, collection, requestConditionTree, conditionalRawCondition),
    ]);

    // If some records don't match the condition then the user
    // is not allow to perform the conditional action
    if (matchingRecordsCount !== requestRecordsCount) {
      return false;
    }
  }

  return true;
}

export function transformToRolesIdsGroupByConditions(
  actionConditionsByRoleId: Map<number, GenericTree>,
): {
  roleIds: number[];
  condition: GenericTree;
}[] {
  const rolesIdsGroupByConditions = Array.from(
    actionConditionsByRoleId,
    ([roleId, conditionGenericTree]) => {
      return {
        roleId,
        conditionGenericTree,
        conditionGenericTreeHash: hashObject(conditionGenericTree, { respectType: false }),
      };
    },
  ).reduce((acc, current) => {
    const { roleId, conditionGenericTree, conditionGenericTreeHash } = current;

    if (acc.has(conditionGenericTreeHash)) {
      acc.get(conditionGenericTreeHash).roleIds.push(roleId);
    } else {
      acc.set(conditionGenericTreeHash, { roleIds: [roleId], condition: conditionGenericTree });
    }

    return acc;
  }, new Map<string, { roleIds: number[]; condition: GenericTree }>());

  return Array.from(rolesIdsGroupByConditions.values());
}
