import { SchemaExecutor } from '../types';
import { SequelizeSchemaExecutor } from './sequelize-executor';
import { MongoSchemaExecutor } from './mongo-executor';
import { UnsupportedSchemaExecutor } from './unsupported-executor';

export class ExecutorFactory {
  static create(nativeDriver: any): SchemaExecutor {
    if (!nativeDriver) {
      return new UnsupportedSchemaExecutor();
    }

    // Sequelize (SQL databases)
    if (nativeDriver.sequelize || nativeDriver.model?.sequelize) {
      return new SequelizeSchemaExecutor(nativeDriver);
    }

    // MongoDB
    if (nativeDriver.db || nativeDriver.connection?.db) {
      return new MongoSchemaExecutor(nativeDriver);
    }

    // Mongoose (uses MongoDB under the hood)
    if (nativeDriver.connection?.db) {
      return new MongoSchemaExecutor(nativeDriver.connection);
    }

    // Unsupported
    return new UnsupportedSchemaExecutor();
  }

  static isSupported(nativeDriver: any): boolean {
    const executor = ExecutorFactory.create(nativeDriver);
    return !(executor instanceof UnsupportedSchemaExecutor);
  }
}
