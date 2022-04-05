import { DataSource } from '../../interfaces/collection';
import { ValueOrHandler } from '../fields';
import ConditionTree from '../../interfaces/query/condition-tree/nodes/base';

export type SegmentContext = {
  dataSource: DataSource;
  timezone: string;
};

export type SegmentDefinition = ValueOrHandler<SegmentContext, ConditionTree>;
