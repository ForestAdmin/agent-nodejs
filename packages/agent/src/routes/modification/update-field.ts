import {
  ConditionTreeFactory,
  FieldValidator,
  Filter,
  Projection,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { HttpCode } from '../../types';
import CollectionRoute from '../collection-route';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';

export default class UpdateField extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.put(
      `/${this.collection.name}/:id/relationships/:field/:index(\\d+)`,
      this.handleUpdate.bind(this),
    );
  }

  public async handleUpdate(context: Context): Promise<void> {
    await this.services.authorization.assertCanEdit(context, this.collection.name);

    const { field, index, id } = context.params;
    const subRecord = context.request.body?.data?.attributes;

    // Validate parameters
    // @fixme At the time of writing this route, the Validator does not support composite types
    FieldValidator.validate(this.collection, field, [{ [field]: [subRecord] }]);

    // Create caller & filter
    const unpackedId = IdUtils.unpackId(this.collection.schema, id);
    const conditionTree = ConditionTreeFactory.intersect(
      ConditionTreeFactory.matchIds(this.collection.schema, [unpackedId]),
      await this.services.authorization.getScope(this.collection, context),
    );

    const caller = QueryStringParser.parseCaller(context);
    const filter = new Filter({ conditionTree });

    // Load & check record
    const [record] = await this.collection.list(caller, filter, new Projection(field));

    if (index > record[field]?.length) {
      throw new ValidationError(`Field '${field}' is too short`);
    }

    record[field][index] = subRecord;

    // Update record
    await this.collection.update(caller, filter, { [field]: record[field] });

    context.response.status = HttpCode.NoContent;
  }
}
