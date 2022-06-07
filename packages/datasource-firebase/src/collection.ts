import {
  AggregateResult,
  BaseCollection,
  ColumnSchema,
  Logger,
  RecordData,
  TSchema,
} from '@forestadmin/datasource-toolkit';
import { FieldSchema } from './schema';
import FirebaseDatasource from './datasource';

export default class FirebaseCollection extends BaseCollection {
  private readonly logger: Logger | undefined;
  private constructor({
    name,
    datasource,
    logger,
  }: {
    name: string;
    datasource: FirebaseDatasource;
    logger?: Logger;
  }) {
    super(name, datasource);
    this.logger = logger;
  }

  async create(): Promise<RecordData[]> {
    throw new Error('Method not implemented.');
  }

  async list(): Promise<RecordData[]> {
    throw new Error('Method not implemented.');
  }

  async update(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async delete(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async aggregate(): Promise<AggregateResult<TSchema, string>[]> {
    throw new Error('Method not implemented.');
  }

  public static create({
    name,
    schema,
    datasource,
    logger,
  }: {
    name: string;
    schema: Record<string, FieldSchema>;
    datasource: FirebaseDatasource;
    logger?: Logger;
  }): FirebaseCollection {
    const collection = new FirebaseCollection({
      name,
      datasource,
      logger,
    });

    collection.addField('id', {
      type: 'Column',
      columnType: 'String',
      isPrimaryKey: true,
      isSortable: false,
    });

    collection.addFirebaseFields(schema);

    return collection;
  }

  private addFirebaseField(name: string, schema: FieldSchema): void {
    const columnSchema: ColumnSchema = {
      ...schema,
      isSortable: false,
      isPrimaryKey: false,
      type: 'Column',
    };

    this.addField(name, columnSchema);
  }

  private addFirebaseFields(schema: Record<string, FieldSchema>): void {
    Object.entries(schema).forEach(([name, fieldSchema]) => {
      this.addFirebaseField(name, fieldSchema);
    });
  }
}
