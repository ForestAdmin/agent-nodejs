import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import ActionCollectionDecorator from './actions/collection';
import DecoratorsStackBase, { Options } from './decorators-stack-base';
import SchemaCollectionDecorator from './schema/collection';
import ValidationCollectionDecorator from './validation/collection';

export default class DecoratorsStackNoCode extends DecoratorsStackBase {
  constructor(dataSource: DataSource, options?: Options) {
    super();

    // It's actually the initial stack in this case. :)
    let last: DataSource = dataSource;

    /* eslint-disable no-multi-assign */
    // Step 0: Do not query datasource when we know the result with yield an empty set.

    last = this.action = new DataSourceDecorator(last, ActionCollectionDecorator);
    last = this.schema = new DataSourceDecorator(last, SchemaCollectionDecorator);
    last = this.validation = new DataSourceDecorator(last, ValidationCollectionDecorator);

    this.finalizeStackSetup(last, options);
  }
}
