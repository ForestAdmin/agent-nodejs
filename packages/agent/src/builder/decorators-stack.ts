import {
  ActionCollectionDecorator,
  ComputedCollectionDecorator,
  DataSource,
  DataSourceDecorator,
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
  // Decorators
  action: DataSourceDecorator<ActionCollectionDecorator>;
  earlyComputed: DataSourceDecorator<ComputedCollectionDecorator>;
  earlyOpEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  earlyOpReplace: DataSourceDecorator<OperatorsReplaceCollectionDecorator>;
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
    /* eslint-disable no-multi-assign */
    // Step 1: Computed-Relation-Computed sandwich (needed because some emulated relations depend
    // on computed fields, and some computed fields depend on relation...)
    // Note that replacement goes before emulation, as replacements may use emulated operators.
    this.dataSource = this.earlyComputed = new DataSourceDecorator(
      dataSource,
      ComputedCollectionDecorator,
    );
    this.dataSource = this.earlyOpEmulate = new DataSourceDecorator(
      this.dataSource,
      OperatorsEmulateCollectionDecorator,
    );
    this.dataSource = this.earlyOpReplace = new DataSourceDecorator(
      this.dataSource,
      OperatorsReplaceCollectionDecorator,
    );
    this.dataSource = this.relation = new DataSourceDecorator(
      this.dataSource,
      RelationCollectionDecorator,
    );
    this.dataSource = this.lateComputed = new DataSourceDecorator(
      this.dataSource,
      ComputedCollectionDecorator,
    );
    this.dataSource = this.lateOpEmulate = new DataSourceDecorator(
      this.dataSource,
      OperatorsEmulateCollectionDecorator,
    );
    this.dataSource = this.lateOpReplace = new DataSourceDecorator(
      this.dataSource,
      OperatorsReplaceCollectionDecorator,
    );

    // Step 2: Those four need access to all fields. They can be loaded in any order.
    this.dataSource = this.search = new DataSourceDecorator(
      this.dataSource,
      SearchCollectionDecorator,
    );
    this.dataSource = this.segment = new DataSourceDecorator(
      this.dataSource,
      SegmentCollectionDecorator,
    );
    this.dataSource = this.sortEmulate = new DataSourceDecorator(
      this.dataSource,
      SortEmulateCollectionDecorator,
    );
    this.dataSource = this.write = new DataSourceDecorator(
      this.dataSource,
      WriteCollectionDecorator,
    );

    // Step 3: Access to all fields AND emulated capabilities
    this.dataSource = this.action = new DataSourceDecorator(
      this.dataSource,
      ActionCollectionDecorator,
    );

    // Step 4: Renaming must be either the very first or very
    // this.dataSource so that naming in customer code
    // is consistent.
    this.dataSource = this.publication = new DataSourceDecorator(
      this.dataSource,
      PublicationCollectionDecorator,
    );
    this.dataSource = this.rename = new DataSourceDecorator(
      this.dataSource,
      RenameCollectionDecorator,
    );
    /* eslint-enable no-multi-assign */
  }
}
