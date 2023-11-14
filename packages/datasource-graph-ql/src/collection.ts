import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  Caller,
  ColumnSchema,
  ConditionTreeLeaf,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
  RelationSchema,
} from '@forestadmin/datasource-toolkit';
import { GraphQLClient } from 'graphql-request';

import { GraphQLModel } from './graphql/types';

export default class GraphQLCollection extends BaseCollection {
  override nativeDriver: GraphQLClient;
  private queryName: string;
  private staticComplexQueryFields: string[];
  private getOneQueryName: string;
  private getOnQueryIdentifier: string;

  override dataSource: DataSource<GraphQLCollection>;

  constructor(dataSource: DataSource, client: GraphQLClient, model: GraphQLModel) {
    super(model.name, dataSource, client);

    this.paginationType = 'cursor';

    model.fields.forEach(({ name, type, isPrimaryKey }) =>
      this.addField(name, {
        columnType: type,
        type: 'Column',
        isPrimaryKey,
        filterOperators: new Set(['Equal', 'In']),
      }),
    );

    const modelIdentifier = model.fields.find(({ isPrimaryKey }) => isPrimaryKey).name;

    model.relations.forEach(({ name, reference, identifier }) =>
      this.addField(name, {
        type: 'ManyToOne',
        foreignCollection: reference,
        foreignKey: modelIdentifier,
        foreignKeyTarget: identifier,
      }),
    );

    this.queryName = model.queryName;
    this.staticComplexQueryFields = this.computeStaticComplexQueryFields(this.schema.fields);
    this.getOneQueryName = model.getOneQueryName;
    this.getOnQueryIdentifier = model.getOnQueryIdentifier;
  }

  private computeStaticComplexQueryFields(fields: BaseCollection['schema']['fields']): string[] {
    return Object.entries(fields)
      .map(([name, field]) => {
        const { columnType } = field as ColumnSchema;

        if (typeof columnType === 'object') {
          const isArray = Array.isArray(columnType);

          return `${name} {${Object.keys(isArray ? columnType[0] : columnType)}}`;
        }
      })
      .filter(Boolean);
  }

  computeProjectionQuery(projection: Projection): string[] {
    const columns = projection.columns.map(column => {
      const queryField = this.staticComplexQueryFields.find(staticComplexQueryField =>
        staticComplexQueryField.startsWith(column),
      );

      return queryField || column;
    });

    const relations = Object.entries(projection.relations).map(
      ([relationName, relationProjection]) => {
        const [_, field] = Object.entries(this.schema.fields).find(
          ([fieldName]) => fieldName === relationName,
        );

        const collection = this.dataSource.getCollection(
          (field as RelationSchema).foreignCollection,
        );
        const projectionQuery = collection.computeProjectionQuery(relationProjection);

        return `${relationName} {${projectionQuery}}`;
      },
    );

    return columns.concat(relations);
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const projectionQuery = this.computeProjectionQuery(projection);

    if (!filter.cursor) {
      if (!this.getOneQueryName) return [];

      const identifier = (filter.conditionTree as ConditionTreeLeaf).value;

      const res = await this.nativeDriver.request(
        `query getRessource {
          ${this.getOneQueryName}(${this.getOnQueryIdentifier}: "${identifier}") {
            ${projectionQuery}
          }
        }`,
      );

      return [res[this.getOneQueryName]];
    }

    const { cursor } = filter;
    const cursorParams = cursor.backward
      ? `before: "${cursor.cursor}" last: ${cursor.limit}`
      : `after: "${cursor.cursor}", first: ${cursor.limit}`;

    const res = await this.nativeDriver.request(
      `query getRessources {
          ${this.queryName}(${cursorParams}) {
            edges {
              node { ${projectionQuery} }
            }
          }
        }`,
    );

    return res[this.queryName].edges.map(({ node }) => node);
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    throw new Error('Not implemented yet');
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    throw new Error('Not implemented yet');
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    throw new Error('Not implemented yet');
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    throw new Error('Not implemented yet');
  }
}
