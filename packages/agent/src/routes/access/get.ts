import { Context } from 'koa';
import Router from '@koa/router';
import { FieldTypes, Projection } from '@forestadmin/datasource-toolkit';
import CollectionBaseRoute from '../collection-base-route';
import IdUtils from '../../utils/id';

export default class ListRoute extends CollectionBaseRoute {
  override setupPrivateRoutes(router: Router): void {
    router.get(`/${this.collection.name}/:id`, this.handleGet.bind(this));
  }

  public async handleGet(context: Context) {
    const projection = this.buildProjection();
    const id = IdUtils.unpackId(this.collection.schema, context.params.id);

    try {
      const record = await this.collection.getById(id, projection);

      context.response.body = this.services.serializer.serialize(this.collection, record);
    } catch {
      context.throw(
        500,
        `Failed to get record using id ${id} on collection "${this.collection.name}"`,
      );
    }
  }

  private buildProjection(): Projection {
    const { fields } = this.collection.schema;

    return Object.keys(fields).reduce((memo, columnName) => {
      const column = fields[columnName];

      if (column.type === FieldTypes.Column) {
        return [...memo, columnName];
      }

      if (column.type === FieldTypes.OneToOne) {
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
  }
}
