import {
  Collection,
  Projection,
  ProjectionFactory,
  ProjectionValidator,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

export default class ProjectionParser {
  static fromCtx(collection: Collection, context: Context): Projection {
    try {
      const fields = context.request.query[`fields[${collection.name}]`];
      if (fields === '' || fields === undefined) return ProjectionFactory.all(collection);

      const { schema } = collection;
      const rootFields = fields.toString().split(',');
      const explicitRequest = rootFields.map(field =>
        schema.fields[field].type === 'Column'
          ? field
          : `${field}:${context.request.query[`fields[${field}]`]}`,
      );

      ProjectionValidator.validate(collection, explicitRequest);

      return new Projection(...explicitRequest);
    } catch (e) {
      throw new ValidationError(`Invalid projection: ${e.message}}`);
    }
  }
}
