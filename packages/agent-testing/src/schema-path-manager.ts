import fs from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const RESERVED_SCHEMA_PREFIX = 'reserved-forestadmin-schema-test-';
export default class SchemaPathManager {
  static generateTemporarySchemaPath(): string {
    const random = Math.floor(Math.random() * 1000000);

    return path.join(tmpdir(), `${RESERVED_SCHEMA_PREFIX}-${random}.json`);
  }

  static async removeTemporarySchemaPath(schemaPath: string): Promise<void> {
    if (SchemaPathManager.isTemporarySchemaPath(schemaPath)) {
      await fs.rm(schemaPath, { force: true });
    }
  }

  private static isTemporarySchemaPath(schemaPath: string): boolean {
    return schemaPath.includes(RESERVED_SCHEMA_PREFIX);
  }
}
