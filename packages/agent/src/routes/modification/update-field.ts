import { FieldValidator, Projection, ValidationError } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import CallerParser from '../../utils/query-parser/caller';
import ListFilterParser from '../../utils/query-parser/filter/list';
import CollectionRoute from '../collection-route';

export default class UpdateField extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.put(
      `/${this.collection.name}/:id/relationships/:field/:index(\\d+)`,
      this.handleUpdate.bind(this),
    );
  }

  public async handleUpdate(context: Context): Promise<void> {
    await this.services.authorization.assertCanEdit(context, this.collection.name);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = context.request.body as any;
    const { field, index } = context.params;
    const subRecord = body?.data?.attributes;

    // Validate parameters
    // @fixme At the time of writing this route, the Validator does not support composite types
    FieldValidator.validate(this.collection, field, [{ [field]: [subRecord] }]);

    // Create caller & filter
    const scope = await this.services.authorization.getScope(this.collection, context);
    const caller = CallerParser.fromCtx(context);
    const filter = ListFilterParser.fromCtx(this.collection, context).intersectWith(scope);

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
