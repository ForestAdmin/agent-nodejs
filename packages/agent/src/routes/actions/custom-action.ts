import {
  ActionResponse,
  ActionResponseType,
  ActionSchema,
  DataSource,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { ForestAdminHttpDriverOptionsWithDefaults, HttpCode } from '../../types';
import { ForestAdminHttpDriverServices } from '../../services';
import BaseActionRoute from './base-action';
import SchemaGeneratorActions from '../../utils/forest-schema/generator-actions';

export default class CustomActionRoute extends BaseActionRoute {
  private actionName: string;

  get actionSchema(): ActionSchema {
    return this.collection.schema.actions[this.actionName];
  }

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
    router.post(`${path}/:slug/hooks/load`, this.handleFormLoad.bind(this));
    router.post(`${path}/:slug/hooks/change`, this.handleFormChange.bind(this));
  }

  private async handleExecute(context: Context): Promise<void> {
    await this.checkPermissions(context);

    const filter = await this.getRecordSelection(context);
    const data = context.request.body.data.attributes.values;
    delete data['Loading...']; // This field is always present in forms with load hook.

    const result = await this.collection.execute(this.actionName, data, filter);
    this.formatExecute(context, result);
  }

  private async handleFormLoad(context: Context): Promise<void> {
    await this.checkPermissions(context);
    await this.formatFields(context, null);
  }

  private async handleFormChange(context: Context): Promise<void> {
    await this.checkPermissions(context);

    const data: Record<string, unknown> = {};
    for (const field of context.request.body.data.attributes.fields)
      data[field.field] = field.value;

    await this.formatFields(context, data);
  }

  private async checkPermissions(context: Context): Promise<void> {
    await this.services.permissions.can(
      context,
      `custom:${this.actionName}:${this.collection.name}`,
    );
  }

  private async formatFields(context: Context, data: RecordData): Promise<void> {
    const filter = await this.getRecordSelection(context);
    const fields = await this.collection.getForm(this.actionName, data, filter);

    context.response.body = {
      fields: fields.map(field =>
        SchemaGeneratorActions.buildFieldSchema(this.collection.dataSource, field),
      ),
    };
  }

  private formatExecute(context: Context, result: ActionResponse): void {
    if (result.type === ActionResponseType.Error) {
      context.response.status = HttpCode.BadRequest;
      context.response.body = { error: result.message };

      return;
    }

    if (result.type === ActionResponseType.Success) {
      context.response.body = {
        [result.format === 'text' ? 'success' : 'html']: result.message,
        refresh: { relationships: result.invalidated },
      };
    } else if (result.type === ActionResponseType.Webhook) {
      const { url, method, headers, body } = result;
      context.response.body = { webhook: { url, method, headers, body } };
    } else if (result.type === ActionResponseType.Redirect) {
      context.response.body = { redirectTo: result.path };
    } else if (result.type === ActionResponseType.File) {
      context.attachment(result.name);
      context.set('Access-Control-Expose-Headers', 'Content-Disposition');
      context.response.type = result.mimeType;
      context.response.body = result.stream;
    } else {
      throw new Error('Unexpected Action result.');
    }
  }
}
