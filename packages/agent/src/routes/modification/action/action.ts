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
  Page,
  PaginatedFilter,
  Projection,
  SchemaUtils,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';

import ActionAuthorizationService from './action-authorization';
import {
  MAX_SNAPSHOT_RECORDS,
  buildRecorder,
  captureActionConfirm,
  captureActionPending,
} from '../../../audit-trail';
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
  // records it actually affected. The pending audit entry is inserted before `execute()` too, for the
  // same reason `instrument.ts` inserts pending rows before a create/update/delete runs: a broken
  // store fails the request *before* the action has any effect, instead of 500ing after it already
  // ran (`critical: true`), or is swallowed and the action proceeds unaudited (`critical: false`,
  // default) — see `captureActionPending`.
  private async executeAndAudit(
    context: Context,
    caller: Caller,
    data: Record<string, unknown>,
    filter: Filter,
  ): Promise<ActionResult> {
    const { auditTrail } = this.options;
    const recordIds = await this.resolveAuditedRecordIds(context, caller, filter);
    const audit = auditTrail
      ? {
          recorder: buildRecorder(
            auditTrail.store,
            undefined,
            auditTrail.critical ?? false,
            this.options.logger,
          ),
          redactedFields: auditTrail.redact?.[this.collection.name] ?? [],
        }
      : null;
    const pending = audit
      ? await captureActionPending(audit.recorder, audit.redactedFields, {
          caller,
          collection: this.collection.name,
          actionName: this.actionName,
          formValues: data,
          recordIds,
        })
      : null;

    try {
      const result = await this.collection.execute(caller, this.actionName, data, filter);

      if (audit && pending) {
        await captureActionConfirm(audit.recorder, pending, result, result.type === 'Error');
      }

      return result;
    } catch (error) {
      if (audit && pending) await captureActionConfirm(audit.recorder, pending, undefined, true);
      throw error;
    }
  }

  // Best-effort under `critical: false`: resolving the audited ids is itself an extra query (see
  // auditedRecordIds), and a transient failure there must not prevent the action from running at
  // all — same principle the pending-capture step below applies. Under `critical: true`, falling
  // back to `[]` would let a record-scoped action run with only a no-record audit entry instead of
  // per-record coverage, which is exactly what `critical` exists to refuse — so this rethrows
  // there instead, refusing the action before execute() runs.
  private async resolveAuditedRecordIds(
    context: Context,
    caller: Caller,
    filter: Filter,
  ): Promise<string[]> {
    if (!this.options.auditTrail) return [];

    try {
      return await this.auditedRecordIds(context, caller, filter);
    } catch (error) {
      if (this.options.auditTrail.critical) throw error;

      this.options.logger(
        'Error',
        `[ForestAdmin] Unable to resolve audited record ids, continuing: ${error}`,
      );

      return [];
    }
  }

  // Packed ids, the form the audit store keys on. A global action targets nothing, and a select-all
  // selection only tells us which ids were *excluded*: naming the targets would mean querying the
  // whole selection, so those runs are recorded once, attached to no record. An explicit selection
  // is narrowed down to the caller's own authorized subset — via `filterForCaller`, the same filter
  // `execute()` itself was given — so an id excluded by scope doesn't get an entry for an action that
  // never touched it.
  //
  // The selection is capped at MAX_SNAPSHOT_RECORDS, same as a bulk update/delete's before-write
  // snapshot (instrument.ts) and the same value the Ruby agent uses for this exact check — one shared
  // constant so the two can't drift apart. Fetching cap+1 is what makes "matched more than the cap"
  // distinguishable from "matched exactly the cap". Over the cap, recording one row per id would be a
  // partial audit of the run, which is what `critical` exists to refuse; non-critical falls back to
  // the existing no-record-attached recording instead of naming a subset of the targets.
  //
  // `filterForCaller` can carry a live-query segment with unresolved `$contextVariable` placeholders
  // — the same filter reaches `getForm`/`execute` unresolved too, but those hand it to the collection
  // as-is; this method calls `collection.list` directly, so it must run the filter through
  // `segmentQueryHandler.handleLiveQuerySegmentFilter` itself first, the same step `list`/`count`
  // apply before their own `collection.list` call.
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

    const paginatedFilter = await this.services.segmentQueryHandler.handleLiveQuerySegmentFilter(
      context,
      new PaginatedFilter({ ...filterForCaller, page: new Page(0, MAX_SNAPSHOT_RECORDS + 1) }),
    );
    const authorized = await this.collection.list(
      caller,
      paginatedFilter,
      new Projection(...SchemaUtils.getPrimaryKeys(this.collection.schema)),
    );

    if (authorized.length <= MAX_SNAPSHOT_RECORDS) {
      return IdUtils.packIds(this.collection.schema, authorized);
    }

    const message =
      `[ForestAdmin] Audit trail: "${this.collection.name}" action "${this.actionName}" targets ` +
      `more than ${MAX_SNAPSHOT_RECORDS} records — recorded as one entry attached to no record.`;

    if (this.options.auditTrail.critical) {
      throw new Error(`${message} Refusing the action because "critical" is enabled.`);
    }

    this.options.logger('Warn', message);

    return [];
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
