import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';
import { Connection, Model } from 'mongoose';

import MongooseCollection from './collection';
import MongooseSchema from './mongoose/schema';
import { MongooseOptions, Stack } from './types';
import { unnest } from './utils/helpers';
import OptionsParser from './utils/options';
import RelationGenerator from './utils/schema/relations';

export default class MongooseDatasource extends BaseDataSource<MongooseCollection> {
  constructor(connection: Connection, options: MongooseOptions = {}, logger: Logger = null) {
    super();

    if (options && !options.flattenMode) {
      logger?.(
        'Warn',
        'Using unspecified flattenMode. ' +
          'Please refer to the documentation to update your code:\n' +
          'https://docs.forestadmin.com/developer-guide-agents-nodejs/data-sources/provided-data-sources/mongoose', // eslint-disable-line max-len
      );
    }

    // Create collections (with only many to one relations).
    for (const model of Object.values(connection.models)) {
      const schema = MongooseSchema.fromModel(model);
      const { asFields, asModels } = OptionsParser.parseOptions(model, options);

      this.addModel(model, schema, [], null, asFields, asModels);
    }

    // Add one-to-many, one-to-one and many-to-many relations.
    RelationGenerator.addImplicitRelations(this.collections);
  }

  /** Create all collections for a given model */
  private addModel(
    model: Model<unknown>,
    schema: MongooseSchema,
    stack: Stack, // current only
    prefix: string | null, // prefix that we should handle in this recursion
    asFields: string[], // current + children
    asModels: string[], // current + children
  ): void {
    const localAsFields = asFields.filter(f => !asModels.some(i => f.startsWith(`${i}.`)));
    const localAsModels = asModels.filter(f => !asModels.some(i => f.startsWith(`${i}.`)));
    const localStack = [...stack, { prefix, asFields: localAsFields, asModels: localAsModels }];

    this.checkAsFields(schema, prefix, localAsFields);
    this.checkAsModels(schema, prefix, localAsModels);
    this.addCollection(new MongooseCollection(this, model, localStack));

    for (const name of localAsModels) {
      const subPrefix = prefix ? `${prefix}.${name}` : name;
      const subAsFields = unnest(asFields, name);
      const subAsModels = unnest(asModels, name);

      this.addModel(model, schema, localStack, subPrefix, subAsFields, subAsModels);
    }
  }

  private checkAsFields(schema: MongooseSchema, prefix: string, localAsFields: string[]): void {
    const localSchema = schema.getSubSchema(prefix);

    for (const field of localAsFields) {
      const name = prefix ? `${prefix}.${field}` : field;

      if (!field.includes('.') && prefix)
        throw new Error(
          `asFields contains "${name}", which can't be flattened further because ` +
            `asModels contains "${prefix}", so it is already at the root of a collection.`,
        );

      if (!field.includes('.'))
        throw new Error(
          `asFields contains "${name}", which can't be flattened because it is already at ` +
            `the root of the model.`,
        );

      if (this.containsIntermediaryArray(localSchema, field))
        throw new Error(
          `asFields contains "${name}", ` +
            `which can't be moved to the root of the model, because it is inside of an array. ` +
            'Either add all intermediary arrays to asModels, or remove it from asFields.',
        );
    }
  }

  private checkAsModels(schema: MongooseSchema, prefix: string, localAsModels: string[]): void {
    const localSchema = schema.getSubSchema(prefix);

    for (const field of localAsModels) {
      const name = prefix ? `${prefix}.${field}` : field;

      if (this.containsIntermediaryArray(localSchema, field))
        throw new Error(
          `asModels contains "${name}", ` +
            `which can't be transformed into a model, because it is inside of an array. ` +
            'Either add all intermediary arrays to asModels, or remove it from asModels.',
        );
    }
  }

  /**
   * When flattening a field, or transforming a field into a model, we need to check that
   * there are no intermediary arrays. For example, if we have a schema like this:
   *  { a: [{ b: { c: String } }] } and we want to flatten a.b.c, we can't do it.
   */
  private containsIntermediaryArray(schema: MongooseSchema, field: string): boolean {
    let index = field.indexOf('.');

    while (index !== -1) {
      const prefix = field.substring(0, index);
      if (schema.getSubSchema(prefix).isArray) return true;
      index = field.indexOf('.', index + 1);
    }

    return false;
  }
}
