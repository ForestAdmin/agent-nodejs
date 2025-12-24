import type { DataSource } from '@forestadmin/datasource-toolkit';

import { DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import ActionCollectionDecorator from './actions/collection';
import DecoratorsStackBase from './decorators-stack-base';
import SchemaCollectionDecorator from './schema/collection';
import ValidationCollectionDecorator from './validation/collection';

export default class DecoratorsStackNoCode extends DecoratorsStackBase {
  buildStack(dataSource: DataSource) {
    // It's actually the initial stack in this case. :)
    let last: DataSource = dataSource;

    // We only need those for the No Code use cases.

    /* eslint-disable no-multi-assign */
    last = this.action = new DataSourceDecorator(last, ActionCollectionDecorator);
    last = this.schema = new DataSourceDecorator(last, SchemaCollectionDecorator);
    last = this.validation = new DataSourceDecorator(last, ValidationCollectionDecorator);

    this.dataSource = last;
  }
}
