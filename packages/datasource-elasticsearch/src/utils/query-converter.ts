import {
  QueryDslBoolQuery,
  QueryDslQueryContainer,
  SortCombinations,
} from '@elastic/elasticsearch/api/types';
import {
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
  Sort,
} from '@forestadmin/datasource-toolkit';

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default class QueryConverter {
  private makeQueryDslQueryContainer(
    field: string,
    operator: Operator,
    value?: unknown,
  ): QueryDslQueryContainer {
    const values = Array.isArray(value) ? value : [value];

    switch (operator) {
      // Presence
      case 'Present':
        return {
          exists: {
            field,
          },
        };
      // eslint-disable-next-line max-len
      // https://www.elastic.co/guide/en/elasticsearch/reference/master/query-dsl-exists-query.html#find-docs-null-values
      case 'Missing':
        return {
          bool: {
            must_not: {
              exists: {
                field,
              },
            },
          },
        };

      // Equality
      case 'Equal':
      case 'In':
      case 'IncludesAll':
        // Silly implementation to optimize queries on PKs
        if (field === '_id')
          return {
            ids: {
              values: Array.isArray(value) ? value : [value],
            },
          };

        if (!values.find(val => Boolean(val))) {
          // isBlank
          return {
            bool: {
              must_not: [
                {
                  exists: {
                    field,
                  },
                },
              ],
            },
          };
        }

        return {
          terms: {
            [field]: values,
          },
        };
      case 'NotEqual':
      case 'NotIn':
        return {
          bool: {
            must_not: {
              terms: {
                [field]: values,
              },
            },
          },
        };

      // Ranges
      case 'LessThan':
        return { range: { [field]: { lt: value as string } } };
      case 'GreaterThan':
        return { range: { [field]: { gt: value as string } } };

      // Strings
      case 'Like':
      case 'ILike':
        return {
          regexp: {
            [field]: {
              value: escapeRegExp(`${value}`).replace(/^%/, '.*').replace(/%$/, '.*'),
              flags: 'NONE',
              case_insensitive: operator === 'ILike',
            },
          },
        };

      case 'NotContains':
        return {
          bool: {
            must_not: {
              wildcard: {
                [field]: { value: `*${value}*`, case_insensitive: true },
              },
            },
          },
        };

      // 'LongerThan',
      // 'ShorterThan',

      default:
        throw new Error(`Unsupported operator: "${operator}".`);
    }
  }

  private getQueryDslQueryContainersFromConditionTree(
    conditionTree?: ConditionTree,
  ): QueryDslQueryContainer {
    if ((conditionTree as ConditionTreeBranch).aggregator !== undefined) {
      const { aggregator, conditions } = conditionTree as ConditionTreeBranch;

      if (aggregator === null) {
        throw new Error('Invalid (null) aggregator.');
      }

      const aggregatorOperator = aggregator === 'And' ? 'must' : 'should';

      if (!Array.isArray(conditions)) {
        throw new Error('Conditions must be an array.');
      }

      return {
        bool: {
          [aggregatorOperator]: conditions.map(condition =>
            this.getQueryDslQueryContainersFromConditionTree(condition),
          ),
        },
      };
    }

    if ((conditionTree as ConditionTreeLeaf).operator !== undefined) {
      const { field, operator, value } = conditionTree as ConditionTreeLeaf;
      const isRelation = field.includes(':');
      // TODO: support this somehow -> Nested queries ?
      // https://www.elastic.co/guide/en/elasticsearch/reference/current/joining-queries.html
      if (isRelation) throw new Error('Unsupported relation ConditionTree.');

      return this.makeQueryDslQueryContainer(field, operator, value);
    }

    throw new Error('Invalid ConditionTree.');
  }

  public getBoolQueryFromConditionTree(
    conditionTree?: ConditionTree,
  ): QueryDslBoolQuery | QueryDslQueryContainer {
    if (!conditionTree) return { match_all: {} };

    return this.getQueryDslQueryContainersFromConditionTree(conditionTree);
  }

  public getOrderFromSort(sort?: Sort): SortCombinations[] {
    return (sort ?? []).map(
      ({ field, ascending }: { field: string; ascending: boolean }): SortCombinations => {
        const path = field.replace(/:/g, '.');

        return { [path]: { order: ascending ? 'asc' : 'desc' } };
      },
    );
  }
}
