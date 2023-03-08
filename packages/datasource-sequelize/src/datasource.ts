import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';
import { ModelAttributeColumnOptions, Sequelize } from 'sequelize';

import SequelizeCollection from './collection';

export default class SequelizeDataSource extends BaseDataSource<SequelizeCollection> {
  /**
   * We can't directly use the Sequelize version we install in the package.json
   * as the customer's version may be different.
   * To ensure compatibility, we need to only import types from Sequelize,
   *    and use the customer sequelize version to deal with the data manipulation.
   */
  protected sequelize: Sequelize = null;

  constructor(sequelize: Sequelize, logger?: Logger) {
    super();

    if (!sequelize) throw new Error('Invalid (null) Sequelize instance.');

    this.sequelize = sequelize;

    this.createCollections(this.sequelize.models, logger);
  }

  protected createCollections(models: Sequelize['models'], logger?: Logger) {
    const modelList = Object.values(models).sort((a, b) => (a.name > b.name ? 1 : -1));

    for (const model of modelList) {
      const hasPrimaryKey = Object.values(model.getAttributes()).some(
        attr => (attr as ModelAttributeColumnOptions).primaryKey,
      );

      if (hasPrimaryKey)
        this.addCollection(new SequelizeCollection(model.name, this, model, logger));
      else
        logger?.('Warn', `Skipping table "${model.name}" because of error: no primary key found.`);
    }
  }
}
