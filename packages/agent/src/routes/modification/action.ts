import {
  ConditionTreeFactory,
  DataSource,
  Filter,
  FilterFactory,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { AgentOptionsWithDefaults, HttpCode } from '../../types';
import { ForestAdminHttpDriverServices } from '../../services';
import BodyParser from '../../utils/body-parser';
import CollectionRoute from '../collection-route';
import ContextFilterFactory from '../../utils/context-filter-factory';
import ForestValueConverter from '../../utils/forest-schema/action-values';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import SchemaGeneratorActions from '../../utils/forest-schema/generator-actions';

export default class ActionRoute extends CollectionRoute {
  private readonly actionName: string;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
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
    const caller = QueryStringParser.parseCaller(context);
    const filter = await this.getRecordSelection(context);
    const rawData = context.request.body.data.attributes.values;

    // As forms are dynamic, we don't have any way to ensure that we're parsing the data correctly
    // => better send invalid data to the getForm() customer handler than to the execute() one.
    const unsafeData = ForestValueConverter.makeFormDataUnsafe(rawData);
    const fields = await this.collection.getForm(caller, this.actionName, unsafeData, filter);

    // Now that we have the field list, we can parse the data again.
    const data = ForestValueConverter.makeFormData(dataSource, rawData, fields);
    const result = await this.collection.execute(caller, this.actionName, data, filter);

    if (result?.type === 'Error') {
      context.response.status = HttpCode.BadRequest;
      context.response.body = { error: result.message, html: result.html };
    } else if (result?.type === 'Success') {
      context.response.body = {
        success: result.message,
        html: result.html,
        refresh: { relationships: [...result.invalidated] },
      };
    } else if (result?.type === 'Webhook') {
      const { url, method, headers, body } = result;
      context.response.body = { webhook: { url, method, headers, body } };
    } else if (result?.type === 'Redirect') {
      context.response.body = { redirectTo: result.path };
    } else if (result?.type === 'File') {
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

    const caller = QueryStringParser.parseCaller(context);
    const filter = await this.getRecordSelection(context);
    const fields = await this.collection.getForm(caller, this.actionName, data, filter);

    context.response.body = {
      fields: fields.map(field =>
        SchemaGeneratorActions.buildFieldSchema(this.collection.dataSource, field),
      ),
    };
  }

  private async checkPermissions(context: Context): Promise<void> {
    await this.services.authorization.assertCanExecuteCustomAction(
      context,
      this.actionName,
      this.collection.name,
    );
  }

  private async getRecordSelection(context: Context): Promise<Filter> {
    const selectionIds = BodyParser.parseSelectionIds(this.collection.schema, context);
    let selectedIds = ConditionTreeFactory.matchIds(this.collection.schema, selectionIds.ids);
    if (selectionIds.areExcluded) selectedIds = selectedIds.inverse();

    const conditionTree = ConditionTreeFactory.intersect(
      selectedIds,
      QueryStringParser.parseConditionTree(this.collection, context),
      await this.services.authorization.getScope(this.collection, context),
    );

    const caller = QueryStringParser.parseCaller(context);
    const filter = ContextFilterFactory.build(this.collection, context, null, { conditionTree });
    const attributes = context.request?.body?.data?.attributes;

    if (attributes?.parent_association_name) {
      const relation = attributes?.parent_association_name;
      const parentCollection = this.dataSource.getCollection(attributes.parent_collection_name);
      const parentId = IdUtils.unpackId(parentCollection.schema, attributes.parent_collection_id);

      return FilterFactory.makeForeignFilter(parentCollection, parentId, relation, caller, filter);
    }

    return filter;
  }
}
