import { Projection } from '@forestadmin/datasource-toolkit';
import { Model, PipelineStage } from 'mongoose';

import MongooseSchema from '../../mongoose/schema';

/**
 * When using the `asModel` options, users can request/filter on the virtual _id and parentId fields
 * of children (using the generated OneToOne relation).
 *
 * As those fields are not written to mongo, they are injected here so that they can be used like
 * any other field.
 *
 * This could be also be done by preprocessing the filter, and postprocessing the records, but this
 * solution seemed simpler, at the cost of additional pipeline stages when making queries.
 *
 * Note that a projection is taken as a parameter so that only fields which are actually used are
 * injected to save resources.
 */
export default class VirtualFieldsGenerator {
  static addVirtual(
    model: Model<unknown>,
    prefix: string,
    ignoredFields: string[],
    projection: Projection,
  ): PipelineStage[] {
    const schema = MongooseSchema.fromModel(model).getSubSchema(prefix, true);
    const set = {};

    for (const [relation, subProjection] of Object.entries(projection.relations)) {
      // if it is a virtual one to one (<=> inverse of "parent")
      if (ignoredFields.includes(relation)) {
        const virtuals = this.getVirtuals(
          relation,
          schema.getSubSchema(relation, true),
          subProjection,
        );

        for (const [key, value] of Object.entries(virtuals)) {
          set[key] = value;
        }
      }
    }

    return Object.keys(set).length ? [{ $addFields: set }] : [];
  }

  static getVirtuals(
    path: string,
    schema: MongooseSchema,
    projection: Projection,
  ): Record<string, unknown> {
    const result = {};

    if (projection.columns.includes('_id')) {
      result[`${path}._id`] = { $concat: [{ $toString: '$_id' }, `.${path}`] };
    }

    if (projection.columns.includes('parentId')) {
      const dotIndex = path.lastIndexOf('.');
      const parentPath = dotIndex !== -1 ? path.substring(0, dotIndex) : null;
      result[`${path}.parentId`] = parentPath
        ? { $concat: [{ $toString: '$_id' }, `.${parentPath}`] }
        : '$_id';
    }

    if (projection.columns.includes('content') && schema.isLeaf) {
      result[`${path}.content`] = `$${path}`;
    }

    for (const [relation, subProjection] of Object.entries(projection.relations)) {
      // If we're asking for data that is inside of this mongo document (and not a __manyToOne)
      // This condition should be equivalent to `!relation.endWith('__manyToOne')` but we want
      // to get rid of the fact that the code depends on the naming.
      if (schema.fields[relation]) {
        const subVirtuals = this.getVirtuals(
          `${path}.${relation}`,
          schema.getSubSchema(relation, true),
          subProjection,
        );

        for (const [key, value] of Object.entries(subVirtuals)) {
          result[key] = value;
        }
      }
    }

    return result;
  }
}
