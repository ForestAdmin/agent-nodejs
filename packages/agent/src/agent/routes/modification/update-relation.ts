import {
  Collection,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  FieldTypes,
  Filter,
  Operator,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Router from '@koa/router';

import { HttpCode } from '../../types';
import IdUtils from '../../utils/id';
import QueryStringParser from '../../utils/query-string';
import RelationRoute from '../relation-route';

export default class UpdateRelation extends RelationRoute {
  setupRoutes(router: Router): void {
    router.put(
      `/${this.collection.name}/:parentId/relationships/${this.relationName}`,

      this.handleUpdateRelationRoute.bind(this),
    );
  }

  public async handleUpdateRelationRoute(context: Context): Promise<void> {
    const data = context.request.body?.data;
    const { id, type } = data;
    const foreignKey = SchemaUtils.getForeignKeyName(this.collection.schema, type);
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);
    const relation = this.collection.schema.fields[this.relationName];
    const timezone = QueryStringParser.parseTimezone(context);

    let targetCollection;
    let conditions;

    if (relation.type === FieldTypes.OneToOne) {
      targetCollection = this.foreignCollection;
      conditions = new ConditionTreeLeaf(foreignKey, Operator.Equal, parentId[0]);
      await this.services.permissions.can(context, `edit:${targetCollection.name}`);
      await this.removePreviousRelation(foreignKey, id, timezone, targetCollection, context);
    } else {
      targetCollection = this.collection;
      conditions = ConditionTreeFactory.matchIds(this.collection.schema, [parentId]);
      await this.services.permissions.can(context, `edit:${targetCollection.name}`);
    }

    const conditionTree = ConditionTreeFactory.intersect(
      conditions,
      await this.services.permissions.getScope(targetCollection, context),
    );
    await targetCollection.update(new Filter({ conditionTree, timezone }), {
      [foreignKey]: IdUtils.unpackId(this.foreignCollection.schema, id),
    });

    context.response.status = HttpCode.NoContent;
  }

  private async removePreviousRelation(
    foreignKey: string,
    id: string,
    timezone: string,
    targetCollection: Collection,
    context: Context,
  ) {
    const conditionTree = ConditionTreeFactory.intersect(
      new ConditionTreeLeaf(foreignKey, Operator.Equal, id),
      await this.services.permissions.getScope(targetCollection, context),
    );
    await targetCollection.update(new Filter({ conditionTree, timezone }), {
      [foreignKey]: null,
    });
  }
}
