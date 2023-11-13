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
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';

export default class QueryConverter {
  private makeQueryDslQueryContainer(
    field: string,
    operator: Operator,
    value?: unknown,
  ): QueryDslQueryContainer {
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

        return {
          terms: {
            [field]: Array.isArray(value) ? value : [value],
          },
        };
      case 'NotEqual':
      case 'NotIn':
        return {
          bool: {
            must_not: {
              terms: {
                [field]: Array.isArray(value) ? value : [value],
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
        // Use more_like_this or match or query_string?
        return {
          wildcard: {
            [field]: { value: `${value}`.replace(/%/g, '*') },
          },
        };
      case 'ILike':
        return {
          wildcard: {
            [field]: {
              value: `${value}`.replace(/%/g, '*'),
              case_insensitive: true,
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

  /*
   * Delete and update methods does not provide the include options.
   * This method is developed to by pass this problem.
   *
   * Not sur that is needed after all
   */
  public async getQueryFromConditionTreeToByPassJoin(
    conditionTree?: ConditionTree,
  ): Promise<QueryDslBoolQuery | QueryDslQueryContainer> {
    const joiningQueries = conditionTree
      ? this.getJoinFromProjection(conditionTree.projection)
      : undefined;
    const boolQuery = this.getBoolQueryFromConditionTree(conditionTree);

    if (!joiningQueries) {
      return boolQuery;
    }

    // TODO merge joiningQueries into boolQuery from conditionTree
    return boolQuery;
  }

  public getBoolQueryFromConditionTree(
    conditionTree?: ConditionTree,
  ): QueryDslBoolQuery | QueryDslQueryContainer {
    if (!conditionTree) return { match_all: {} };

    const rawDSLQuery = this.getQueryDslQueryContainersFromConditionTree(conditionTree);

    return rawDSLQuery;
  }

  private getJoinFromProjection(projection: Projection): QueryDslQueryContainer[] {
    // eslint-disable-next-line max-len
    // https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-has-child-query.html

    // https://www.elastic.co/guide/en/elasticsearch/reference/master/joining-queries.html
    return Object.entries(projection.relations).map(([relationName, relationProjection]) => {
      if (this.getJoinFromProjection(relationProjection).length > 0)
        throw new Error('Conditions must be an array.');

      return {
        parent_id: {
          type: relationName,
          id: '1', // Must look into this
        },
      };
    });
  }

  public getOrderFromSort(sort: Sort): SortCombinations[] {
    return (sort ?? []).map(
      ({ field, ascending }: { field: string; ascending: boolean }): SortCombinations => {
        const path = field.replace(/:/g, '.');

        return { [path]: { order: ascending ? 'asc' : 'desc' } };
      },
    );
  }
}
