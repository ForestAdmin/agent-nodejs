import {
  Collection,
  FieldTypes,
  Projection,
  ProjectionUtils,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

export default class QueryStringParser {
  static parseProjection(collection: Collection, context: Context): Projection {
    try {
      let rootFields = context.request.query[`fields[${collection.name}]`];

      rootFields = rootFields.toString().split(',');

      const explicitRequest = rootFields.map(field => {
        const schema = collection.schema.fields[field];

        return schema.type === FieldTypes.Column
          ? field
          : `${field}:${context.request.query[`fields[${field}]`]}`;
      });

      ProjectionUtils.validate(collection, explicitRequest);

      // primary keys are not explicitly listed in the projections that the frontend
      // is sending, but are still required for the frontend to work.
      return ProjectionUtils.withPks(collection, explicitRequest);
    } catch (e) {
      context.throw(400, `Invalid projection (${e.message})`);
    }
  }
}
