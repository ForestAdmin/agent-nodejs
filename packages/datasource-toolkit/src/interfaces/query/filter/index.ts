import ConditionTree, { PlainConditionTree } from '../condition-tree/nodes/base';
import Page, { PlainPage } from '../page';
import Sort, { PlainSortClause } from '../sort';

export type FilterComponents = {
  conditionTree?: ConditionTree;
  search?: string;
  searchExtended?: boolean;
  segment?: string;
  sort?: Sort;
  page?: Page;
};

export type PlainFilter = {
  conditionTree?: PlainConditionTree;
  search?: string;
  searchExtended?: boolean;
  segment?: string;
  sort?: Array<PlainSortClause>;
  page?: PlainPage;
};

export default class Filter {
  conditionTree?: ConditionTree;
  search?: string;
  searchExtended?: boolean;
  segment?: string;
  sort?: Sort;
  page?: Page;

  get isNestable(): boolean {
    return !this.search && !this.segment;
  }

  constructor(parts: FilterComponents) {
    this.conditionTree = parts.conditionTree;
    this.search = parts.search;
    this.searchExtended = parts.searchExtended;
    this.segment = parts.segment;
    this.sort = parts.sort;
    this.page = parts.page;
  }

  override(fields: FilterComponents): Filter {
    return new Filter({ ...this, ...fields });
  }

  nest(prefix: string): Filter {
    if (!this.isNestable) throw new Error("Filter can't be nested");

    return this.override({
      conditionTree: this.conditionTree ? this.conditionTree.nest(prefix) : this.conditionTree,
      sort: this.sort?.nest(prefix),
    });
  }
}
