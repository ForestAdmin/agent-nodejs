import {
  ActionResultType,
  ConditionTreeFactory,
  DataSource,
  Filter,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { ForestAdminHttpDriverOptionsWithDefaults, HttpCode } from '../../types';
import { ForestAdminHttpDriverServices } from '../../services';
import BodyParser from '../../utils/body-parser';
import CollectionRoute from '../collection-route';
import ForestValueConverter from '../../utils/forest-schema/action-values';
import QueryStringParser from '../../utils/query-string';
import SchemaGeneratorActions from '../../utils/forest-schema/generator-actions';

export default class ActionRoute extends CollectionRoute {
  private actionName: string;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: ForestAdminHttpDriverOptionsWithDefaults,
    dataSource: DataSource,
    collectionName: string,
    actionName: string,
  ) {
    super(services, options, dataSource, collectionName);
    this.actionName = actionName;
  }

  setupRoutes(router: Router): void {
    const actionIndex = Object.keys(this.collection.schema.actions).indexOf(this.actionName);
    const path = `/_actions/${this.collection.name}/${actionIndex}`;

    router.post(`${path}/:slug`, this.handleExecute.bind(this));
    router.post(`${path}/:slug/hooks/load`, this.handleHook.bind(this));
    router.post(`${path}/:slug/hooks/change`, this.handleHook.bind(this));
  }

  private async handleExecute(context: Context): Promise<void> {
    await this.checkPermissions(context);

    const { dataSource } = this.collection;
    const filter = await this.getRecordSelection(context);
    const rawData = context.request.body.data.attributes.values;

    // As forms are dynamic, we don't have any way to ensure that we're parsing the data correctly
    // => better send invalid data to the getForm() customer handler than to the execute() one.
    const unsafeData = ForestValueConverter.makeFormDataUnsafe(rawData);
    const fields = await this.collection.getForm(this.actionName, unsafeData);

    // Now that we have the field list, we can parse the data again.
    const data = ForestValueConverter.makeFormData(dataSource, rawData, fields);
    const result = await this.collection.execute(this.actionName, data, filter);

    if (result?.type === ActionResultType.Error) {
      context.response.status = HttpCode.BadRequest;
      context.response.body = { error: result.message };
    } else if (result?.type === ActionResultType.Success) {
      context.response.body = {
        [result.format === 'text' ? 'success' : 'html']: result.message,
        refresh: { relationships: [...result.invalidated] },
      };
    } else if (result?.type === ActionResultType.Webhook) {
      const { url, method, headers, body } = result;
      context.response.body = { webhook: { url, method, headers, body } };
    } else if (result?.type === ActionResultType.Redirect) {
      context.response.body = { redirectTo: result.path };
    } else if (result?.type === ActionResultType.File) {
      context.response.attachment(result.name);
      context.response.set('Access-Control-Expose-Headers', 'Content-Disposition');
      context.response.type = result.mimeType;
      context.response.body = result.stream;
    } else {
      throw new Error('Unexpected Action result.');
    }
  }

  private async handleHook(context: Context): Promise<void> {
    await this.checkPermissions(context);

    const { dataSource } = this.collection;
    const forestFields = context.request.body?.data?.attributes?.fields;
    const data = forestFields
      ? ForestValueConverter.makeFormDataFromFields(dataSource, forestFields)
      : null;

    const filter = await this.getRecordSelection(context);
    const fields = await this.collection.getForm(this.actionName, data, filter);

    context.response.body = {
      fields: fields.map(field =>
        SchemaGeneratorActions.buildFieldSchema(this.collection.dataSource, field),
      ),
    };
  }

  private async checkPermissions(context: Context): Promise<void> {
    await this.services.permissions.can(
      context,
      `custom:${this.actionName}:${this.collection.name}`,
    );
  }

  private async getRecordSelection(context: Context): Promise<Filter> {
    const selectionIds = BodyParser.parseSelectionIds(this.collection.schema, context);
    let selectedIds = ConditionTreeFactory.matchIds(this.collection.schema, selectionIds.ids);
    if (selectionIds.areExcluded) selectedIds = selectedIds.inverse();

    const conditionTree = ConditionTreeFactory.intersect(
      selectedIds,
      QueryStringParser.parseConditionTree(this.collection, context),
      await this.services.permissions.getScope(this.collection, context),
    );

    const filter = new Filter({
      conditionTree,
      search: QueryStringParser.parseSearch(this.collection, context),
      searchExtended: QueryStringParser.parseSearchExtended(context),
      segment: QueryStringParser.parseSegment(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
    });

    return filter;
  }
}
