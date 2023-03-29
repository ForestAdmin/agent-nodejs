import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';

import SequelizeCollection from './collection';

export default class SequelizeDataSource extends BaseDataSource<SequelizeCollection> {
  /**
   * We can't directly use the Sequelize version we install in the package.json
   * as the customer's version may be different.
   * To ensure compatibility, we need to only import types from Sequelize,
   *    and use the customer sequelize version to deal with the data manipulation.
   */
  protected sequelize: Sequelize = null;

  constructor(sequelize: Sequelize, logger?: Logger, options?: { castUuidToString: boolean }) {
    super();

    if (!sequelize) throw new Error('Invalid (null) Sequelize instance.');

    this.sequelize = sequelize;

    this.createCollections(this.sequelize.models, logger, options);
  }

  protected createCollections(
    models: Sequelize['models'],
    logger?: Logger,
    options?: { castUuidToString: boolean },
  ) {
    Object.values(models ?? {})
      // avoid schema reordering
      .sort((modelA, modelB) => (modelA.name > modelB.name ? 1 : -1))
      .forEach(model => {
        const collection = new SequelizeCollection(model.name, this, model, logger, options);
        this.addCollection(collection);
      });
  }
}
