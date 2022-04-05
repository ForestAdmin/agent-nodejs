import { DataSource } from '../../interfaces/collection';
import { ValueOrHandler } from '../fields';
import ConditionTree from '../../interfaces/query/condition-tree/nodes/base';

export type OperatorReplacer = ValueOrHandler<
  { value: unknown; dataSource: DataSource },
  ConditionTree
>;
