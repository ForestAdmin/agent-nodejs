import { ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { CollectionActionEvent } from '../../services/authorization';
import { HttpCode, SelectionIds } from '../../types';
import BodyParser from '../../utils/body-parser';
import CollectionRoute from '../collection-route';
import ContextFilterFactory from '../../utils/context-filter-factory';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';

export default class DeleteRoute extends CollectionRoute {
  setupRoutes(router: Router): void {
    router.delete(`/${this.collection.name}`, this.handleListDelete.bind(this));
    router.delete(`/${this.collection.name}/:id`, this.handleDelete.bind(this));
  }

  public async handleDelete(context: Context): Promise<void> {
    await this.services.authorization.assertCanOnCollection(
      context,
      CollectionActionEvent.Delete,
      this.collection.name,
    );

    const id = IdUtils.unpackId(this.collection.schema, context.params.id);
    await this.deleteRecords(context, { ids: [id], areExcluded: false });

    context.response.status = HttpCode.NoContent;
  }

  public async handleListDelete(context: Context): Promise<void> {
    const selectionIds = BodyParser.parseSelectionIds(this.collection.schema, context);
    await this.deleteRecords(context, selectionIds);

    context.response.status = HttpCode.NoContent;
  }

  private async deleteRecords(context: Context, selectionIds: SelectionIds): Promise<void> {
    let selectedIds = ConditionTreeFactory.matchIds(this.collection.schema, selectionIds.ids);
    if (selectionIds.areExcluded) selectedIds = selectedIds.inverse();

    const caller = QueryStringParser.parseCaller(context);
    const filter = ContextFilterFactory.build(this.collection, context, null, {
      conditionTree: ConditionTreeFactory.intersect(
        QueryStringParser.parseConditionTree(this.collection, context),
        await this.services.permissions.getScope(this.collection, context),
        selectedIds,
      ),
    });

    await this.collection.delete(caller, filter);
  }
}
