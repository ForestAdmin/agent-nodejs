import { DataSource, DataSourceDecorator, Logger } from '@forestadmin/datasource-toolkit';

import ActionCollectionDecorator from './actions/collection';
import BinaryCollectionDecorator from './binary/collection';
import ChartDataSourceDecorator from './chart/datasource';
import ComputedCollectionDecorator from './computed/collection';
import EmptyCollectionDecorator from './empty/collection';
import HookCollectionDecorator from './hook/collection';
import OperatorsEmulateCollectionDecorator from './operators-emulate/collection';
import OperatorsEquivalenceCollectionDecorator from './operators-equivalence/collection';
import PublicationDataSourceDecorator from './publication/datasource';
import RenameFieldCollectionDecorator from './rename-field/collection';
import SchemaCollectionDecorator from './schema/collection';
import SearchCollectionDecorator from './search/collection';
import SegmentCollectionDecorator from './segment/collection';
import SortEmulateCollectionDecorator from './sort-emulate/collection';
import ValidationCollectionDecorator from './validation/collection';
import WriteDataSourceDecorator from './write/datasource';

export default class DecoratorsStack {
  action: DataSourceDecorator<ActionCollectionDecorator>;
  binary: DataSourceDecorator<BinaryCollectionDecorator>;
  chart: ChartDataSourceDecorator;
  computed: DataSourceDecorator<ComputedCollectionDecorator>;
  opEmulate: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  hook: DataSourceDecorator<HookCollectionDecorator>;
  publication: PublicationDataSourceDecorator;
  renameField: DataSourceDecorator<RenameFieldCollectionDecorator>;
  schema: DataSourceDecorator<SchemaCollectionDecorator>;
  search: DataSourceDecorator<SearchCollectionDecorator>;
  segment: DataSourceDecorator<SegmentCollectionDecorator>;
  sortEmulate: DataSourceDecorator<SortEmulateCollectionDecorator>;
  validation: DataSourceDecorator<ValidationCollectionDecorator>;
  write: WriteDataSourceDecorator;
  dataSource: DataSource;

  private customizations: Array<(logger: Logger) => Promise<void>> = [];

  constructor(dataSource: DataSource) {
    let last: DataSource = dataSource;

    /* eslint-disable no-multi-assign */
    // Step 0: Do not query datasource when we know the result with yield an empty set.
    last = new DataSourceDecorator(last, EmptyCollectionDecorator);
    last = new DataSourceDecorator(last, OperatorsEquivalenceCollectionDecorator);

    // Step 1: Computed Field and Relation (enhance data)
    last = this.computed = new DataSourceDecorator(last, ComputedCollectionDecorator);
    last = this.opEmulate = new DataSourceDecorator(last, OperatorsEmulateCollectionDecorator);

    last = new DataSourceDecorator(last, OperatorsEquivalenceCollectionDecorator);

    // Step 2: Those need access to all fields. They can be loaded in any order.
    last = this.search = new DataSourceDecorator(last, SearchCollectionDecorator);
    last = this.segment = new DataSourceDecorator(last, SegmentCollectionDecorator);
    last = this.sortEmulate = new DataSourceDecorator(last, SortEmulateCollectionDecorator);

    // Step 3: Access to all fields AND emulated capabilities
    last = this.chart = new ChartDataSourceDecorator(last);
    last = this.action = new DataSourceDecorator(last, ActionCollectionDecorator);
    last = this.schema = new DataSourceDecorator(last, SchemaCollectionDecorator);
    last = this.write = new WriteDataSourceDecorator(last);
    last = this.hook = new DataSourceDecorator(last, HookCollectionDecorator);
    last = this.validation = new DataSourceDecorator(last, ValidationCollectionDecorator);
    last = this.binary = new DataSourceDecorator(last, BinaryCollectionDecorator);

    // Step 4: Renaming must be either the very first or very last so that naming in customer code
    // is consistent.
    last = this.publication = new PublicationDataSourceDecorator(last);
    last = this.renameField = new DataSourceDecorator(last, RenameFieldCollectionDecorator);
    /* eslint-enable no-multi-assign */

    this.dataSource = last;
  }

  queueCustomization(customization: (logger: Logger) => Promise<void>): void {
    this.customizations.push(customization);
  }

  /**
   * Apply all customizations
   * Plugins may queue new customizations, or call other plugins which will queue customizations.
   *
   * This method will be called recursively and clears the queue at each recursion to ensure
   * that all customizations are applied in the right order.
   */
  async applyQueuedCustomizations(logger: Logger): Promise<void> {
    const queuedCustomizations = this.customizations.slice();
    this.customizations.length = 0;

    while (queuedCustomizations.length) {
      await queuedCustomizations.shift()(logger); // eslint-disable-line no-await-in-loop
      await this.applyQueuedCustomizations(logger); // eslint-disable-line no-await-in-loop
    }
  }
}
