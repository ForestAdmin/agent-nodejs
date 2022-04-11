import { ColumnType } from '../../interfaces/schema';
import { RecordData } from '../../interfaces/record';
import CollectionCustomizationContext from '../../context/collection-context';

export interface ComputedDefinition {
  readonly columnType: ColumnType;
  readonly dependencies: string[];
  readonly isRequired?: boolean;
  readonly defaultValue?: unknown;
  readonly enumValues?: string[];

  getValues(
    records: RecordData[],
    context: CollectionCustomizationContext,
  ): Promise<unknown[]> | unknown[];
}
