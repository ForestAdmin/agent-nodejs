import ConditionTree, { PlainConditionTree } from '../condition-tree/nodes/base';

export type FilterComponents = {
  conditionTree?: ConditionTree;
  search?: string | null;
  searchExtended?: boolean;
  segment?: string;
  liveQuerySegment?: { query: string; connectionName: string };
};

export type PlainFilter = {
  conditionTree?: PlainConditionTree;
  search?: string;
  searchExtended?: boolean;
  segment?: string;
};

export default class Filter {
  conditionTree?: ConditionTree;
  search?: string;
  searchExtended?: boolean;
  segment?: string;
  liveQuerySegment?: { query: string; connectionName: string };

  get isNestable(): boolean {
    return !this.search && !this.segment;
  }

  constructor(parts: FilterComponents) {
    this.conditionTree = parts.conditionTree;
    this.search = parts.search;
    this.searchExtended = parts.searchExtended;
    this.segment = parts.segment;
    this.liveQuerySegment = parts.liveQuerySegment;
  }

  override(fields: FilterComponents): Filter {
    return new Filter({ ...this, ...fields });
  }

  nest(prefix: string): Filter {
    if (!this.isNestable) throw new Error("Filter can't be nested");

    return this.override({
      conditionTree: this.conditionTree ? this.conditionTree.nest(prefix) : this.conditionTree,
    });
  }
}
