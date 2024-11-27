import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';
import { QueryTypes, Sequelize } from 'sequelize';

import SequelizeCollection from './collection';
import { SequelizeDatasourceOptions } from './types';

interface NativeQueryConnection {
  instance: Sequelize;
}

export default class SequelizeDataSource extends BaseDataSource<SequelizeCollection> {
  /**
   * We can't directly use the Sequelize version we install in the package.json
   * as the customer's version may be different.
   * To ensure compatibility, we need to only import types from Sequelize,
   *    and use the customer sequelize version to deal with the data manipulation.
   */
  protected sequelize: Sequelize = null;

  constructor(sequelize: Sequelize, logger?: Logger, options?: SequelizeDatasourceOptions) {
    super();

    if (!sequelize) throw new Error('Invalid (null) Sequelize instance.');
    if (!sequelize.models) throw new Error('Invalid (null) Sequelize models.');

    this.sequelize = sequelize;

    this.createCollections(this.sequelize.models, logger);

    if (options?.liveQueryConnections) {
      this.addNativeQueryConnection(options.liveQueryConnections, { instance: this.sequelize });
    }
  }

  async close(): Promise<void> {
    await this.sequelize.close();
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

  override async executeNativeQuery<R extends object>(
    connectionName: string,
    query: string,
    contextVariables = {},
  ): Promise<R[]> {
    if (!this.nativeQueryConnections[connectionName]) {
      throw new Error(`Unknown connection name '${connectionName}'`);
    }

    return (this.nativeQueryConnections[connectionName] as NativeQueryConnection).instance.query<R>(
      query,
      {
        bind: contextVariables,
        type: QueryTypes.SELECT,
        raw: true,
      },
    );
  }
}
