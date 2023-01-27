import { DataSource, Filter, UnprocessableError } from '@forestadmin/datasource-toolkit';
import { UserInfo } from '@forestadmin/forestadmin-client';
import Router from '@koa/router';
import { Context, Next } from 'koa';

import ActionAuthorizationService from './action-authorization';
import { ForestAdminHttpDriverServices } from '../../../services';
import {
  SmartActionApprovalRequestBody,
  SmartActionRequestBody,
} from '../../../services/authorization/types';
import { AgentOptionsWithDefaults, HttpCode } from '../../../types';
import ForestValueConverter from '../../../utils/forest-schema/action-values';
import SchemaGeneratorActions from '../../../utils/forest-schema/generator-actions';
import CallerParser from '../../../utils/query-parser/caller';
import FilterParser from '../../../utils/query-parser/filter';
import CollectionRoute from '../../collection-route';

export default class ActionRoute extends CollectionRoute {
  private readonly actionName: string;

  private actionAuthorizationService: ActionAuthorizationService;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    dataSource: DataSource,
    collectionName: string,
    actionName: string,
  ) {
    super(services, options, dataSource, collectionName);
    this.actionName = actionName;

    this.actionAuthorizationService = new ActionAuthorizationService(options.forestAdminClient);
  }

  setupRoutes(router: Router): void {
    const actionIndex = Object.keys(this.collection.schema.actions).indexOf(this.actionName);
    const path = `/_actions/${this.collection.name}/${actionIndex}`;

    router.post(
      `${path}/:slug`,
      this.middlewareCustomActionApprovalRequestData.bind(this),
      this.handleExecute.bind(this),
    );
    router.post(`${path}/:slug/hooks/load`, this.handleHook.bind(this));
    router.post(`${path}/:slug/hooks/change`, this.handleHook.bind(this));
  }

  private async handleExecute(context: Context): Promise<void> {
    const { dataSource } = this.collection;

    const caller = CallerParser.fromCtx(context);
    const [filterForCaller, filterForAllCaller] = await Promise.all([
      this.getRecordSelection(context),
      this.getRecordSelection(context, false),
    ]);
    const requestBody = context.request.body as SmartActionApprovalRequestBody;

    const canPerformCustomActionParams = {
      caller,
      customActionName: this.actionName,
      collection: this.collection,
      filterForCaller,
      filterForAllCaller,
    };

    if (requestBody?.data?.attributes?.requester_id) {
      await this.actionAuthorizationService.assertCanApproveCustomAction({
        ...canPerformCustomActionParams,
        requesterId: requestBody.data.attributes.requester_id,
      });
    } else {
      await this.actionAuthorizationService.assertCanTriggerCustomAction(
        canPerformCustomActionParams,
      );
    }

    const rawData = requestBody.data.attributes.values;

    // As forms are dynamic, we don't have any way to ensure that we're parsing the data correctly
    // => better send invalid data to the getForm() customer handler than to the execute() one.
    const unsafeData = ForestValueConverter.makeFormDataUnsafe(rawData);
    const fields = await this.collection.getForm(
      caller,
      this.actionName,
      unsafeData,
      filterForCaller,
    );

    // Now that we have the field list, we can parse the data again.
    const data = ForestValueConverter.makeFormData(dataSource, rawData, fields);
    const result = await this.collection.execute(caller, this.actionName, data, filterForCaller);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = context.request.body as any;
    const { id: userId } = context.state.user as UserInfo;

    await this.actionAuthorizationService.assertCanRequestCustomActionParameters({
      userId,
      customActionName: this.actionName,
      collectionName: this.collection.name,
    });

    const { dataSource } = this.collection;
    const forestFields = body?.data?.attributes?.fields;
    const data = forestFields
      ? ForestValueConverter.makeFormDataFromFields(dataSource, forestFields)
      : null;

    const caller = CallerParser.fromCtx(context);
    const filter = await this.getRecordSelection(context);
    const fields = await this.collection.getForm(caller, this.actionName, data, filter);

    context.response.body = {
      fields: fields.map(field =>
        SchemaGeneratorActions.buildFieldSchema(this.collection.dataSource, field),
      ),
    };
  }

  private async middlewareCustomActionApprovalRequestData(context: Context, next: Next) {
    const requestBody = context.request.body as SmartActionApprovalRequestBody;

    // We forbid requester_id from default request as it's only retrieved from
    // signed_approval_request
    if (requestBody?.data?.attributes?.requester_id) {
      throw new UnprocessableError();
    }

    if (requestBody?.data?.attributes?.signed_approval_request) {
      const signedParameters =
        this.options.forestAdminClient.verifySignedActionParameters<SmartActionRequestBody>(
          requestBody.data.attributes.signed_approval_request,
        );

      context.request.body = signedParameters;
    }

    return next();
  }

  private async getRecordSelection(context: Context, includeUserScope = true): Promise<Filter> {
    const [filter, scope] = await Promise.all([
      FilterParser.action(this.collection, context),
      this.services.authorization.getScope(this.collection, context),
    ]);

    return includeUserScope ? filter.intersectWith(scope) : filter;
  }
}
