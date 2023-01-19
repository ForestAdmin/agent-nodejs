import { Model } from 'mongoose';

import MongooseSchema from '../mongoose/schema';
import {
  FlattenOptions,
  LegacyFlattenOptions,
  ManualFlattenOptions,
  MongooseOptions,
} from '../types';

export default class OptionsParser {
  static parseOptions(model: Model<unknown>, options: MongooseOptions): FlattenOptions {
    const schema = MongooseSchema.fromModel(model);

    switch (options.flattenMode) {
      case 'auto':
        return this.getAutoFlattenOptions(schema);
      case 'manual':
        return this.getManualFlattenOptions(schema, options, model.modelName);
      case 'none':
        return { asFields: [], asModels: [] };
      default:
        return this.getLegacyFlattenOptions(schema, options, model.modelName);
    }
  }

  private static getAutoFlattenOptions(schema: MongooseSchema): FlattenOptions {
    // Split on all arrays of objects and arrays of references.
    const asModels = schema
      .listPathsMatching((_, s) => s.isArray && (!s.isLeaf || s.schemaNode?.options?.ref))
      .sort();

    // flatten all fields which are nested
    const asFields = schema.listPathsMatching((field, pathSchema) => {
      // on veut flatten si on est à plus de 1 niveau de profondeur par rapport au asModels
      const minDistance = asModels.reduce((acc, asModel) => {
        return field.startsWith(`${asModel}.`)
          ? Math.min(acc, field.split('.').length - asModel.split('.').length)
          : acc;
      }, field.split('.').length);

      return !asModels.includes(field) && pathSchema.isLeaf && minDistance > 1;
    });

    return { asFields, asModels };
  }

  private static getManualFlattenOptions(
    schema: MongooseSchema,
    options: ManualFlattenOptions,
    modelName: string,
  ): FlattenOptions {
    // If the user specified either asModels or asFields for this model, we apply it.
    const asModels = (options?.flattenOptions?.[modelName]?.asModels ?? [])
      .map(f => f.replace(/:/g, '.'))
      .sort();

    const asFields = (options?.flattenOptions?.[modelName]?.asFields ?? [])
      .flatMap(item => {
        const field = (typeof item === 'string' ? item : item.field).replace(/:/g, '.');
        const level = typeof item === 'string' ? 99 : item.level;
        const subSchema = schema.getSubSchema(field);

        return subSchema.isLeaf ? [field] : subSchema.listFields(level).map(f => `${field}.${f}`);
      })
      .filter(f => !asModels.includes(f)) // asModels takes precedence over asFields
      .sort(); // sort so that subfields appear after their parent

    return { asFields, asModels };
  }

  private static getLegacyFlattenOptions(
    schema: MongooseSchema,
    options: LegacyFlattenOptions,
    modelName: string,
  ): FlattenOptions {
    let asFields: string[];
    let asModels: string[];

    if (options?.asModels?.[modelName]) {
      // [legacy mode] retro-compatibility when customer provided asModels
      const cuts = new Set(options.asModels[modelName].map(f => f.replace(/:/g, '.')));

      for (let field of cuts) {
        while (field.lastIndexOf('.') !== -1) {
          field = field.substring(0, field.lastIndexOf('.'));
          cuts.add(field);
        }
      }

      asFields = [];
      asModels = [...cuts].sort();
    } else {
      // [legacy mode] retro-compatibility when customer did not provice anything
      asFields = [];
      asModels = Object.keys(schema.fields)
        .filter(field => schema.fields[field]?.['[]']?.options?.ref)
        .sort();
    }

    return { asFields, asModels };
  }
}
