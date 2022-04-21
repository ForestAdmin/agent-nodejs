import { Sequelize } from 'sequelize';

import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';

import SequelizeCollection from './collection';

export default class SequelizeDataSource extends BaseDataSource<SequelizeCollection> {
  protected sequelize: Sequelize = null;

  constructor(logger: Logger, sequelize: Sequelize) {
    super();

    if (!sequelize) throw new Error('Invalid (null) Sequelize instance.');

    this.sequelize = sequelize;

    this.createCollections(this.sequelize.models);
  }

  protected createCollections(models: Sequelize['models']) {
    Object.values(models)
      // avoid schema reordering
      .sort((modelA, modelB) => (modelA.name > modelB.name ? 1 : -1))
      .forEach(model => {
        const collection = new SequelizeCollection(model.name, this, model);
        this.addCollection(collection);
      });
  }
}
