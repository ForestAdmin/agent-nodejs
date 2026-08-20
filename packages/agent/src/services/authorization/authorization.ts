import type { RequestedProjection } from '../../utils/query-string';
import type { Collection, ConditionTree } from '@forestadmin/datasource-toolkit';
import type { ForestAdminClient } from '@forestadmin/forestadmin-client';
import type { Context } from 'koa';

import { getSearchedFieldPaths } from '@forestadmin/datasource-customizer';
import { ForbiddenError, Projection, UnprocessableError } from '@forestadmin/datasource-toolkit';
import {
  ChainedSQLQueryError,
  CollectionActionEvent,
  EmptySQLQueryError,
  NonSelectSQLQueryError,
} from '@forestadmin/forestadmin-client';

import { HttpCode } from '../../types';
import ConditionTreeParser from '../../utils/condition-tree-parser';
import FieldPathUtils from '../../utils/field-path';
import QueryStringParser from '../../utils/query-string';

type FieldUsage = { action: string; path: string; collectionName: string };

export default class AuthorizationService {
  constructor(private readonly forestAdminClient: ForestAdminClient) {}

  public async assertCanBrowse(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Browse, context, collectionName);
  }

  public async assertCanRead(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Read, context, collectionName);
  }

  public async assertCanAdd(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Add, context, collectionName);
  }

  public async assertCanEdit(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Edit, context, collectionName);
  }

  public async assertCanDelete(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Delete, context, collectionName);
  }

  public async assertCanExport(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Export, context, collectionName);
  }

  public async canRead(context: Context, collectionName: string): Promise<boolean> {
    return this.forestAdminClient.permissionService.canOnCollection({
      userId: context.state.user.id,
      event: CollectionActionEvent.Read,
      collectionName,
    });
  }

  /**
   * An unnamed field is redacted rather than refused: `ProjectionFactory.all` expands every column
   * of every to-one relation when no `fields[]` is sent, so refusing would turn an ordinary
   * listing into a 403.
   */
  public async redactProjection(
    context: Context,
    collection: Collection,
    requested: RequestedProjection,
  ): Promise<Projection> {
    const { projection, explicit } = requested;
    const owners = projection.map(path => FieldPathUtils.getLeafCollection(collection, path).name);
    const permissions = await this.getReadPermissions(context, collection.name, owners);
    const isReadable = (index: number) => permissions.get(owners[index]);

    if (explicit) {
      const denied = projection
        .map((field, index) => ({ field, collection: owners[index] }))
        .filter((_, index) => !isReadable(index));

      if (denied.length) {
        const fields = denied
          .map(({ field, collection: name }) => `'${field}' from the '${name}' collection`)
          .join(', ');

        throw new ForbiddenError(`You are not allowed to read ${fields}.`);
      }
    }

    return new Projection(...projection.filter((_, index) => isReadable(index)));
  }

  /**
   * Refused rather than redacted: dropping a condition widens the result set and dropping a sort
   * clause silently reorders it, while both leak the value they touch anyway — a `starts_with`
   * filter answers one guess per request without returning a column of its own.
   */
  public async assertCanReadQueryFields(context: Context, collection: Collection): Promise<void> {
    const usages: FieldUsage[] = [];
    const push = (action: string, path: string) =>
      usages.push({
        action,
        path,
        collectionName: FieldPathUtils.getLeafCollection(collection, path).name,
      });

    QueryStringParser.parseConditionTree(collection, context)?.forEachLeaf(leaf =>
      push('filter on', leaf.field),
    );

    for (const { field } of QueryStringParser.parseSort(collection, context)) {
      push('sort on', field);
    }

    const search = QueryStringParser.parseSearch(collection, context);

    if (search) {
      // `relation.column:term` is end-user search syntax and works without extended search, so the
      // paths it names are resolved by the search decorator's own resolver rather than guessed at.
      for (const path of getSearchedFieldPaths(collection, search)) push('search on', path);

      if (QueryStringParser.parseSearchExtended(context)) {
        for (const [name, field] of Object.entries(collection.schema.fields)) {
          if (field.type === 'ManyToOne' || field.type === 'OneToOne') {
            usages.push({
              action: 'run an extended search through',
              path: name,
              collectionName: field.foreignCollection,
            });
          }
        }
      }
    }

    await this.assertCanReadUsages(context, collection.name, usages);
  }

  public async assertCanReadUsages(
    context: Context,
    rootCollectionName: string,
    usages: FieldUsage[],
  ): Promise<void> {
    const permissions = await this.getReadPermissions(
      context,
      rootCollectionName,
      usages.map(usage => usage.collectionName),
    );
    const denied = usages.find(usage => !permissions.get(usage.collectionName));

    if (denied) {
      throw new ForbiddenError(
        `You cannot ${denied.action} '${denied.path}': you are not allowed to read the ` +
          `'${denied.collectionName}' collection.`,
      );
    }
  }

  /** The root is skipped: its own route already asserts `browse` on a listing, `read` on a get. */
  private async getReadPermissions(
    context: Context,
    rootCollectionName: string,
    collectionNames: string[],
  ): Promise<Map<string, boolean>> {
    const toCheck = [...new Set(collectionNames)].filter(name => name !== rootCollectionName);
    const allowed = await Promise.all(toCheck.map(name => this.canRead(context, name)));

    return new Map<string, boolean>([
      [rootCollectionName, true],
      ...toCheck.map((name, index): [string, boolean] => [name, allowed[index]]),
    ]);
  }

  private async assertCanOnCollection(
    event: CollectionActionEvent,
    context: Context,
    collectionName: string,
  ) {
    const { id: userId, renderingId } = context.state.user;

    const canOnCollection = await this.forestAdminClient.permissionService.canOnCollection({
      userId,
      event,
      collectionName,
    });

    if (
      context.request?.query &&
      CollectionActionEvent.Browse === event &&
      (context.request.query as { segmentQuery?: string }).segmentQuery
    ) {
      const { segmentQuery, connectionName } = context.request.query as {
        segmentQuery?: string;
        connectionName?: string;
      };

      const canExecuteSegmentQuery =
        await this.forestAdminClient.permissionService.canExecuteSegmentQuery({
          userId,
          collectionName,
          renderingId,
          segmentQuery,
          connectionName,
        });

      if (!canExecuteSegmentQuery) context.throw(HttpCode.Forbidden, 'Forbidden');
    }

    if (!canOnCollection) {
      context.throw(HttpCode.Forbidden, 'Forbidden');
    }
  }

  public async assertCanExecuteChart(context: Context): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartRequest = context.request.body as any;
    const { renderingId, id: userId } = context.state.user;

    try {
      const canRetrieve = await this.forestAdminClient.permissionService.canExecuteChart({
        renderingId,
        userId,
        chartRequest,
      });

      if (!canRetrieve) {
        context.throw(HttpCode.Forbidden, 'Forbidden');
      }
    } catch (error) {
      if (
        error instanceof EmptySQLQueryError ||
        error instanceof ChainedSQLQueryError ||
        error instanceof NonSelectSQLQueryError
      ) {
        throw new UnprocessableError(error.message);
      }

      throw error;
    }
  }

  public async getScope(collection: Collection, context: Context): Promise<ConditionTree> {
    const { user } = context.state;

    const scope = await this.forestAdminClient.getScope({
      renderingId: user.renderingId,
      userId: user.id,
      collectionName: collection.name,
    });

    if (!scope) return null;

    return ConditionTreeParser.fromPlainObject(collection, scope);
  }

  public invalidateScopeCache(renderingId: number | string) {
    this.forestAdminClient.markScopesAsUpdated(renderingId);
  }
}
