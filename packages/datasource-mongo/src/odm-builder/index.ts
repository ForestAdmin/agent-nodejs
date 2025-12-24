/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { ModelAnalysis, ModelDefinition, PrimitiveDefinition } from '../introspection/types';
import type { Connection, Mongoose } from 'mongoose';

import { Schema } from 'mongoose';

export default class OdmBuilder {
  private static readonly primitives: Partial<Record<PrimitiveDefinition, unknown>> = {
    boolean: Boolean,
    number: Number,
    string: String,
    Date,
    Binary: Buffer,
    Mixed: Schema.Types.Mixed,
    ObjectId: Schema.Types.ObjectId,
  };

  static defineModels(connection: Connection | Mongoose, study: ModelDefinition[]) {
    for (const collection of study) {
      const definition = this.buildDefinition(undefined, collection.analysis);

      connection.model(
        collection.name,
        new Schema(definition, {
          // eslint-disable-next-line no-underscore-dangle
          versionKey: collection.analysis.object?.__v ? '__v' : false,
        }),
        collection.name,
      );
    }
  }

  private static buildDefinition(name: string | undefined, node: ModelAnalysis): unknown {
    const VERSION_PROPERTY_NAME = '__v';

    if (node.type === 'array') {
      return [this.buildDefinition(`${name}[]`, node.arrayElement!)];
    }

    if (node.type === 'object') {
      const entries = Object.entries(node.object!)
        // Automatic property added by Mongoose
        .filter(([path]) => path !== VERSION_PROPERTY_NAME)
        .map(([path, child]) => [
          path,
          this.buildDefinition([name, path].filter(Boolean).join('.'), child),
        ]);

      return Object.fromEntries(entries);
    }

    const assumePrimaryKey = name === '_id';
    const autoPrimaryKey = assumePrimaryKey && node.type === 'ObjectId';

    const result: Record<string, unknown> = {
      type: this.primitives[node.type],
      required: !node.nullable && !autoPrimaryKey,
      auto: autoPrimaryKey,
    };

    if (node.referenceTo) result.ref = node.referenceTo;

    return result;
  }
}
