import ConditionTree from '../condition-tree/nodes/base';

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

  override(fields: FilterComponents): Filter {
    return new Filter({ ...this, ...fields });
  }
}
