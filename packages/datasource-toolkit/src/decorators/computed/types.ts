import { ColumnType } from '../../interfaces/schema';
import { DataSource } from '../../interfaces/collection';
import { RecordData } from '../../interfaces/record';
import Projection from '../../interfaces/query/projection';

export type ComputedContext = {
  dataSource: DataSource;
};

export interface ComputedDefinition {
  readonly columnType: ColumnType;
  readonly dependencies: Projection;
  readonly isRequired?: boolean;
  readonly defaultValue?: unknown;
  readonly enumValues?: string[];

  getValues(records: RecordData[], context: ComputedContext): Promise<unknown[]> | unknown[];
}

export interface ProxyDefinition {
  path: string;
}
