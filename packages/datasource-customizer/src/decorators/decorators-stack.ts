import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import ActionCollectionDecorator from './actions/collection';
import BinaryCollectionDecorator from './binary/collection';
import ChartDataSourceDecorator from './chart/datasource';
import ComputedCollectionDecorator from './computed/collection';
import DecoratorsStackBase, { Options } from './decorators-stack-base';
import EmptyCollectionDecorator from './empty/collection';
import HookCollectionDecorator from './hook/collection';
import LazyJoinDecorator from './lazy-join/collection';
import OperatorsEmulateCollectionDecorator from './operators-emulate/collection';
import OperatorsEquivalenceCollectionDecorator from './operators-equivalence/collection';
import OverrideCollectionDecorator from './override/collection';
import PublicationDataSourceDecorator from './publication/datasource';
import RelationCollectionDecorator from './relation/collection';
import RenameFieldCollectionDecorator from './rename-field/collection';
import SchemaCollectionDecorator from './schema/collection';
import SearchCollectionDecorator from './search/collection';
import SegmentCollectionDecorator from './segment/collection';
import SortEmulateCollectionDecorator from './sort-emulate/collection';
import ValidationCollectionDecorator from './validation/collection';
import WriteDataSourceDecorator from './write/datasource';

export default class DecoratorsStack extends DecoratorsStackBase {
  constructor(dataSource: DataSource, options?: Options) {
    super();

    let last: DataSource = dataSource;

    /* eslint-disable no-multi-assign */
    // Step 0: Do not query datasource when we know the result with yield an empty set.
    last = this.override = new DataSourceDecorator(last, OverrideCollectionDecorator);
    last = new DataSourceDecorator(last, EmptyCollectionDecorator);
    last = new DataSourceDecorator(last, OperatorsEquivalenceCollectionDecorator);

    // Step 1: Computed-Relation-Computed sandwich (needed because some emulated relations depend
    // on computed fields, and some computed fields depend on relation...)
    // Note that replacement goes before emulation, as replacements may use emulated operators.
    last = this.earlyComputed = new DataSourceDecorator(last, ComputedCollectionDecorator);
    last = this.earlyOpEmulate = new DataSourceDecorator(last, OperatorsEmulateCollectionDecorator);
    last = new DataSourceDecorator(last, OperatorsEquivalenceCollectionDecorator);
    last = this.relation = new DataSourceDecorator(last, RelationCollectionDecorator);
    last = new DataSourceDecorator(last, LazyJoinDecorator);
    last = this.lateComputed = new DataSourceDecorator(last, ComputedCollectionDecorator);
    last = this.lateOpEmulate = new DataSourceDecorator(last, OperatorsEmulateCollectionDecorator);
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

    this.finalizeStackSetup(last, options);
  }
}
