import { CompositeId, FieldTypes, Projection } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';
import CollectionRoute from '../collection-base-route';

export default class GetRoute extends CollectionRoute {
  private static RECORD_NOT_FOUND_ERROR = 'Record does not exist';

  override setupPrivateRoutes(router: Router): void {
    router.get(`/${this.collection.name}/:id`, this.handleGet.bind(this));
  }

  public async handleGet(context: Context) {
    const projection = this.buildProjection();

    let id: CompositeId;

    try {
      id = IdUtils.unpackId(this.collection.schema, context.params.id);
    } catch (e) {
      context.throw(HttpCode.BadRequest, e.message);
    }

    try {
      const record = await this.collection.getById(id, projection);

      if (!record) {
        throw new Error(GetRoute.RECORD_NOT_FOUND_ERROR);
      }

      context.response.body = this.services.serializer.serialize(this.collection, record);
    } catch (error) {
      if (error.message === GetRoute.RECORD_NOT_FOUND_ERROR) {
        context.throw(
          HttpCode.NotFound,
          `Record id ${id} does not exist on collection "${this.collection.name}"`,
        );
      } else {
        context.throw(
          HttpCode.InternalServerError,
          `Failed to get record using id ${id} on collection "${this.collection.name}"`,
        );
      }
    }
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
