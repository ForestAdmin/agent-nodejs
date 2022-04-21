import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';

import SequelizeCollection from './collection';

export default class SequelizeDataSource extends BaseDataSource<SequelizeCollection> {
  protected sequelize: Sequelize = null;

  constructor(sequelize: Sequelize, logger?: Logger) {
    super();

    if (!sequelize) throw new Error('Invalid (null) Sequelize instance.');

    this.sequelize = sequelize;

    this.createCollections(this.sequelize.models, logger);
  }

  protected createCollections(models: Sequelize['models'], logger?: Logger) {
    Object.values(models)
      // avoid schema reordering
      .sort((modelA, modelB) => (modelA.name > modelB.name ? 1 : -1))
      .forEach(model => {
        const collection = new SequelizeCollection(model.name, this, model, logger);
        this.addCollection(collection);
      });
  }
}
