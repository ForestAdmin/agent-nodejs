import {
  Collection,
  CompositeId,
  ConditionTree,
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
    const foreignKey = SchemaUtils.getForeignKeyName(this.collection.schema, data.type);
    const parentId = IdUtils.unpackId(this.collection.schema, context.params.parentId);

    const { targetCollection, conditions } = this.getRelationRoutes(foreignKey, parentId);

    await this.services.permissions.can(context, `edit:${targetCollection.name}`);

    const newId = IdUtils.unpackId(this.foreignCollection.schema, data.id);
    const conditionTree = ConditionTreeFactory.intersect(
      conditions,
      await this.services.permissions.getScope(targetCollection, context),
    );
    const timezone = QueryStringParser.parseTimezone(context);
    await targetCollection.update(new Filter({ conditionTree, timezone }), {
      [foreignKey]: newId,
    });

    context.response.status = HttpCode.NoContent;
  }

  private getRelationRoutes(
    foreignKey: string,
    parentId: CompositeId,
  ): { targetCollection: Collection; conditions: ConditionTree } {
    const relation = this.collection.schema.fields[this.relationName];

    if (relation.type === FieldTypes.OneToOne)
      return {
        targetCollection: this.foreignCollection,
        conditions: new ConditionTreeLeaf(foreignKey, Operator.Equal, parentId[0]),
      };

    return {
      targetCollection: this.collection,
      conditions: ConditionTreeFactory.matchIds(this.collection.schema, [parentId]),
    };
  }
}
