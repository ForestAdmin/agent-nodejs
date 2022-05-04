import {
  ActionCollectionDecorator,
  ComputedCollectionDecorator,
  DataSource,
  DataSourceDecorator,
  EmptyCollectionDecorator,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
  RelationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  SortEmulateCollectionDecorator,
  WriteCollectionDecorator,
} from '@forestadmin/datasource-toolkit';

export default class DecoratorsStack {
  action: DataSourceDecorator<ActionCollectionDecorator>;
  earlyComputed: DataSourceDecorator<ComputedCollectionDecorator>;
  earlyOpEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  earlyOpReplace: DataSourceDecorator<OperatorsReplaceCollectionDecorator>;
  empty: DataSourceDecorator<EmptyCollectionDecorator>;
  relation: DataSourceDecorator<RelationCollectionDecorator>;
  lateComputed: DataSourceDecorator<ComputedCollectionDecorator>;
  lateOpEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  lateOpReplace: DataSourceDecorator<OperatorsReplaceCollectionDecorator>;
  publication: DataSourceDecorator<PublicationCollectionDecorator>;
  rename: DataSourceDecorator<RenameCollectionDecorator>;
  search: DataSourceDecorator<SearchCollectionDecorator>;
  segment: DataSourceDecorator<SegmentCollectionDecorator>;
  sortEmulate: DataSourceDecorator<SortEmulateCollectionDecorator>;
  write: DataSourceDecorator<WriteCollectionDecorator>;
  dataSource: DataSource;

  constructor(dataSource: DataSource) {
    let last: DataSource = dataSource;

    /* eslint-disable no-multi-assign */
    // Step 0: Do not query datasource when we know the result with yield an empty set.
    last = this.empty = new DataSourceDecorator(last, EmptyCollectionDecorator);

    // Step 1: Computed-Relation-Computed sandwich (needed because some emulated relations depend
    // on computed fields, and some computed fields depend on relation...)
    // Note that replacement goes before emulation, as replacements may use emulated operators.
    last = this.earlyComputed = new DataSourceDecorator(last, ComputedCollectionDecorator);
    last = this.earlyOpEmulate = new DataSourceDecorator(last, OperatorsEmulateCollectionDecorator);
    last = this.earlyOpReplace = new DataSourceDecorator(last, OperatorsReplaceCollectionDecorator);
    last = this.relation = new DataSourceDecorator(last, RelationCollectionDecorator);
    last = this.lateComputed = new DataSourceDecorator(last, ComputedCollectionDecorator);
    last = this.lateOpEmulate = new DataSourceDecorator(last, OperatorsEmulateCollectionDecorator);
    last = this.lateOpReplace = new DataSourceDecorator(last, OperatorsReplaceCollectionDecorator);

    // Step 2: Those four need access to all fields. They can be loaded in any order.
    last = this.search = new DataSourceDecorator(last, SearchCollectionDecorator);
    last = this.segment = new DataSourceDecorator(last, SegmentCollectionDecorator);
    last = this.sortEmulate = new DataSourceDecorator(last, SortEmulateCollectionDecorator);
    last = this.write = new DataSourceDecorator(last, WriteCollectionDecorator);

    // Step 3: Access to all fields AND emulated capabilities
    last = this.action = new DataSourceDecorator(last, ActionCollectionDecorator);

    // Step 4: Renaming must be either the very first or very last so that naming in customer code
    // is consistent.
    last = this.publication = new DataSourceDecorator(last, PublicationCollectionDecorator);
    last = this.rename = new DataSourceDecorator(last, RenameCollectionDecorator);
    /* eslint-enable no-multi-assign */

    this.dataSource = last;
  }
}
