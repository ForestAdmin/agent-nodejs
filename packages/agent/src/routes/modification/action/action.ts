import type { ForestAdminHttpDriverServices } from '../../../services';
import type {
  SmartActionApprovalRequestBody,
  SmartActionHookRequestBody,
  SmartActionRequestBody,
} from '../../../services/authorization/types';
import type { AgentOptionsWithDefaults } from '../../../types';
import type { ActionResult, Caller, DataSource, Filter } from '@forestadmin/datasource-toolkit';
import type { UserInfo } from '@forestadmin/forestadmin-client';
import type Router from '@koa/router';
import type { Context, Next } from 'koa';

import {
  ConditionTreeFactory,
  FilterFactory,
  PaginatedFilter,
  Projection,
  SchemaUtils,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

import ActionAuthorizationService from './action-authorization';
import { captureAction } from '../../../audit-trail';
import { HttpCode } from '../../../types';
import BodyParser from '../../../utils/body-parser';
import ContextFilterFactory from '../../../utils/context-filter-factory';
import ForestValueConverter from '../../../utils/forest-schema/action-values';
import SchemaGeneratorActions from '../../../utils/forest-schema/generator-actions';
import IdUtils from '../../../utils/id';
import QueryStringParser from '../../../utils/query-string';
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
    // Generate url that matches the declaration in forest-schema/generator-actions.ts
    const actionIndex = Object.keys(this.collection.schema.actions).indexOf(this.actionName);
    const slug = SchemaGeneratorActions.getActionSlug(this.actionName);

    let path = `/_actions/${this.collectionUrlSlug}/`;

    if (!this.options.useUnsafeActionEndpoint) {
      path += `${actionIndex}/`;
    }

    path += slug;

    router.post(
      `${path}`,
      this.middlewareCustomActionApprovalRequestData.bind(this),
      this.handleExecute.bind(this),
    );
    router.post(`${path}/hooks/load`, this.handleHook.bind(this));
    router.post(`${path}/hooks/change`, this.handleHook.bind(this));
    router.post(`${path}/hooks/search`, this.handleHook.bind(this));
  }

  private async handleExecute(context: Context): Promise<void> {
    const { dataSource } = this.collection;

    const caller = QueryStringParser.parseCaller(context);
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
    const form = await this.collection.getForm(
      caller,
      this.actionName,
      unsafeData,
      filterForCaller,
      { includeHiddenFields: true }, // during execute, we need all possible fields
    );

    const { fields } = SchemaGeneratorActions.extractFieldsAndLayout(form);

    // Now that we have the field list, we can parse the data again.
    const data = ForestValueConverter.makeFormData(dataSource, rawData, fields);
    const result = await this.executeAndAudit(context, caller, data, filterForCaller);

    if (result.responseHeaders) {
      context.response.set(result.responseHeaders);
    }

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

  // A failed run is worth recording too: "who tried to run this" is usually the interesting part.
  // A resolved `{ type: 'Error' }` result counts as failed as well — the customer-declared action
  // rejected the request (HTTP 400 below), it just didn't throw to say so.
  //
  // Record ids are resolved *before* `execute()` runs, not after: the action itself may delete the
  // targeted records or change a field their own selection filter matched on, so resolving them
  // afterward could find nothing and silently lose the association between the audit entry and the
  // records it actually affected.
  private async executeAndAudit(
    context: Context,
    caller: Caller,
    data: Record<string, unknown>,
    filter: Filter,
  ): Promise<ActionResult> {
    const recordIds = this.options.auditTrail
      ? await this.auditedRecordIds(context, caller, filter)
      : [];

    try {
      const result = await this.collection.execute(caller, this.actionName, data, filter);
      await this.auditAction(caller, data, recordIds, result.type === 'Error');

      return result;
    } catch (error) {
      await this.auditAction(caller, data, recordIds, true);
      throw error;
    }
  }

  private async auditAction(
    caller: Caller,
    formValues: Record<string, unknown>,
    recordIds: string[],
    failed = false,
  ): Promise<void> {
    const { auditTrail } = this.options;
    if (!auditTrail) return;

    try {
      await captureAction(
        record => auditTrail.store.append(record),
        auditTrail.redact?.[this.collection.name] ?? [],
        { caller, collection: this.collection.name, formValues, recordIds, failed },
      );
    } catch (error) {
      // The action has already run (or failed on its own): a broken audit store must not also fail
      // the request, which would report a successful run as an error and could prompt a client retry
      // that reruns the action.
      this.options.logger('Error', `[ForestAdmin] Audit trail unavailable, skipping: ${error}`);
    }
  }

  // Packed ids, the form the audit store keys on. A global action targets nothing, and a select-all
  // selection only tells us which ids were *excluded*: naming the targets would mean querying the
  // whole selection, so those runs are recorded once, attached to no record. An explicit selection
  // is narrowed down to the caller's own authorized subset — via `filterForCaller`, the same filter
  // `execute()` itself was given — so an id excluded by scope doesn't get an entry for an action that
  // never touched it.
  private async auditedRecordIds(
    context: Context,
    caller: Caller,
    filterForCaller: Filter,
  ): Promise<string[]> {
    if (this.collection.schema.actions[this.actionName].scope === 'Global') return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attributes = (context.request.body as any)?.data?.attributes;

    if (attributes?.all_records) return [];
    if (!attributes?.ids?.length) return [];

    const authorized = await this.collection.list(
      caller,
      new PaginatedFilter({ ...filterForCaller }),
      new Projection(...SchemaUtils.getPrimaryKeys(this.collection.schema)),
    );

    return IdUtils.packIds(this.collection.schema, authorized);
  }

  private async handleHook(context: Context): Promise<void> {
    const body = context.request.body as SmartActionHookRequestBody;
    const { id: userId } = context.state.user as UserInfo;

    await this.actionAuthorizationService.assertCanRequestCustomActionParameters({
      userId,
      customActionName: this.actionName,
      collectionName: this.collection.name,
    });

    const { dataSource } = this.collection;
    const forestFields = body.data.attributes.fields;
    const data = forestFields
      ? ForestValueConverter.makeFormDataFromFields(dataSource, forestFields)
      : null;
    const searchValues: Record<string, string | null> = {};

    if (forestFields) {
      for (const field of forestFields) {
        searchValues[field.field] = field.searchValue;
      }
    }

    const caller = QueryStringParser.parseCaller(context);
    const filter = await this.getRecordSelection(context);
    const form = await this.collection.getForm(caller, this.actionName, data, filter, {
      changedField: body.data.attributes.changed_field,
      searchField: body.data.attributes.search_field,
      searchValues,
      includeHiddenFields: false,
    });

    context.response.body = SchemaGeneratorActions.buildFieldsAndLayout(
      this.collection.dataSource,
      form,
    );
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = context.request.body as any;
    const attributes = body?.data?.attributes;

    // Match user filter + search + scope? + segment.
    const scope = includeUserScope
      ? await this.services.authorization.getScope(this.collection, context)
      : null;
    let filter = ContextFilterFactory.build(this.collection, context, scope);

    // Restrict the filter to the selected records for single or bulk actions.
    if (this.collection.schema.actions[this.actionName].scope !== 'Global') {
      const selectionIds = BodyParser.parseSelectionIds(this.collection.schema, context);
      let selectedIds = ConditionTreeFactory.matchIds(this.collection.schema, selectionIds.ids);
      if (selectionIds.areExcluded) selectedIds = selectedIds.inverse();

      filter = filter.override({
        conditionTree: ConditionTreeFactory.intersect(filter.conditionTree, selectedIds),
      });
    }

    // Restrict the filter further for the "related data" page.
    if (attributes?.parent_association_name) {
      const caller = QueryStringParser.parseCaller(context);
      const relation = attributes?.parent_association_name;
      const parent = this.dataSource.getCollection(attributes.parent_collection_name);
      const parentId = IdUtils.unpackId(parent.schema, attributes.parent_collection_id);

      filter = await FilterFactory.makeForeignFilter(parent, parentId, relation, caller, filter);
    }

    return filter;
  }
}
