import {
  ConditionTreeFactory,
  FieldTypes,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { HttpCode } from '../../types';
import CollectionRoute from '../collection-route';
import IdUtils from '../../utils/id';

export default class GetRoute extends CollectionRoute {
  override setupPrivateRoutes(router: Router): void {
    router.get(`/${this.collection.name}/:id`, this.handleGet.bind(this));
  }

  public async handleGet(context: Context) {
    const id = IdUtils.unpackId(this.collection.schema, context.params.id);
    const filter = new PaginatedFilter({
      conditionTree: ConditionTreeFactory.intersect(
        ConditionTreeFactory.matchIds(this.collection.schema, [id]),
        await this.services.scope.getConditionTree(this.collection, context),
      ),
    });

    const records = await this.collection.list(filter, this.buildProjection());

    if (!records.length) {
      context.throw(HttpCode.NotFound, 'Record does not exists');
    }

    context.response.body = this.services.serializer.serialize(this.collection, records[0]);
  }

  private buildProjection(): Projection {
    const schemaFields = this.collection.schema.fields;
    const projectionFields = Object.entries(schemaFields).reduce((memo, [columnName, column]) => {
      if (column.type === FieldTypes.Column) {
        return [...memo, columnName];
      }

      if (column.type === FieldTypes.OneToOne || column.type === FieldTypes.ManyToOne) {
        const relation = this.dataSource.getCollection(column.foreignCollection);
        const relationFields = relation.schema.fields;

        return [
          ...memo,
          ...Object.keys(relationFields)
            .filter(relColumnName => relationFields[relColumnName].type === FieldTypes.Column)
            .map(relColumnName => `${columnName}:${relColumnName}`),
        ];
      }

      return memo;
    }, [] as string[]);

    return new Projection(...projectionFields);
  }
}
