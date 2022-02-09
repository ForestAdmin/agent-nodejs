import { DataSource } from '../../interfaces/collection';
import ConditionTree from '../../interfaces/query/condition-tree/nodes/base';

export type OperatorReplacer = (value: unknown, dataSource: DataSource) => Promise<ConditionTree>;
