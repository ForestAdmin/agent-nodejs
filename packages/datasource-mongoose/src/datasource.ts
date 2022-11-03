import { BaseDataSource, Projection } from '@forestadmin/datasource-toolkit';
import { Connection, Model } from 'mongoose';

import MongooseCollection from './collection';
import MongooseSchema from './mongoose/schema';
import { MongooseOptions } from './types';
import RelationGenerator from './utils/schema/relations';

export default class MongooseDatasource extends BaseDataSource<MongooseCollection> {
  constructor(connection: Connection, options: MongooseOptions = {}) {
    super();

    // Create collections (with only many to one relations).
    for (const model of Object.values(connection.models)) {
      this.addModel(model, this.getCuts(options, model));
    }

    // Add one-to-many, one-to-one and many-to-many relations.
    RelationGenerator.addImplicitRelations(this.collections);
  }

  /** Create all collections for a given model */
  private addModel(model: Model<unknown>, cuts: Projection, prefix: string = null): void {
    const ignore = [...new Set([...cuts.columns, ...Object.keys(cuts.relations)])];

    this.addCollection(new MongooseCollection(this, model, prefix, ignore));

    for (const name of ignore) {
      const subProjection = cuts.relations[name] ?? new Projection();
      const subPrefix = prefix ? `${prefix}.${name}` : name;
      this.addModel(model, subProjection, subPrefix);
    }
  }

  /** Get list of cuts for a given model */
  private getCuts(options: MongooseOptions, model: Model<unknown>): Projection {
    // A list was provided by the customer, use it.
    if (options?.asModels?.[model.modelName]) {
      return new Projection(
        ...options.asModels[model.modelName].map(item => item.replace(/\./g, ':')),
      );
    }

    // When no cuts are provided, only cut on list of references
    const schema = MongooseSchema.fromModel(model);

    return new Projection(
      ...Object.keys(schema.fields).filter(field => schema.fields[field]?.['[]']?.options?.ref),
    );
  }
}
