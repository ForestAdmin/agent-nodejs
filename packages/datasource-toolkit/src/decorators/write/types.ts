import { RecordData } from '../../interfaces/record';
import WriteCustomizationContext from './context';

export type WriteDefinition = (
  value: unknown,
  context: WriteCustomizationContext,
) => Promise<RecordData | void> | RecordData | void;
