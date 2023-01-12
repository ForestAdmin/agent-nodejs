import { Projection } from '@forestadmin/datasource-toolkit';
import { AnyExpression, Model, PipelineStage } from 'mongoose';

import { Stack } from '../../types';

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
  static addVirtual(model: Model<unknown>, stack: Stack, projection: Projection): PipelineStage[] {
    const set = {};

    for (const colonField of projection) {
      const field = colonField.replace(/:/g, '.');
      const isFromOneToOne = stack[stack.length - 1].asModels.some(f => field.startsWith(`${f}.`));

      if (isFromOneToOne) {
        set[field] = this.getPath(field);
      }
    }

    return Object.keys(set).length ? [{ $addFields: set }] : [];
  }

  private static getPath(field: string): AnyExpression {
    if (field.endsWith('._id')) {
      const suffix = field.substring(0, field.length - 4);

      return { $concat: [{ $toString: '$_id' }, `.${suffix}`] };
    }

    if (field.endsWith('.parentId')) {
      if (field.split('.').length > 2) {
        // Implementing this would require us to have knowledge of the value of asModel for
        // for virtual models under the current one, which the `stack` variable does not have.

        // If the expcetion causes issues we could simply return
        // `$${field.substring(0, field.length - 9)}._id` but that would not work if the customer
        // jumped over multiple levels of nesting.

        // As this is a use case that never happens from the UI, and that can be worked around when
        // using the API, we decided to not implement it.

        throw new Error('Fetching virtual parentId deeper than 1 level is not supported.');
      }

      return '$_id';
    }

    if (field.endsWith('.content')) {
      // FIXME: we should check that this is really a leaf field because "content" can't
      // really be used as a reserved word
      return `$${field.substring(0, field.length - 8)}`;
    }
  }
}
