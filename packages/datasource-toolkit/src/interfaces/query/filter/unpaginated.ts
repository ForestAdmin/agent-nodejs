import { RecordData } from '../../record';
import ConditionTree from '../condition-tree/base';

export type FilterComponents = {
  conditionTree?: ConditionTree;
  search?: string;
  searchExtended?: boolean;
  segment?: string;
  timezone?: string;
};

export default class Filter {
  conditionTree?: ConditionTree;
  search?: string;
  searchExtended?: boolean;
  segment?: string;
  timezone?: string;

  constructor(parts: FilterComponents) {
    this.conditionTree = parts.conditionTree;
    this.search = parts.search;
    this.searchExtended = parts.searchExtended;
    this.segment = parts.segment;
    this.timezone = parts.timezone;
  }

  apply(records: RecordData[]): RecordData[] {
    if (this.search || this.segment) {
      throw new Error('Cannot emulate search or segment');
    }

    let result = records;
    if (this.conditionTree) result = this.conditionTree.apply(records);

    return result;
  }

  override(fields: FilterComponents): Filter {
    return new Filter({ ...this, ...fields });
  }
}
