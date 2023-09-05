import { Scope } from '@nestjs/common';

import { CardCustomizer } from '../typings';

export default (collection: CardCustomizer) =>
  collection
    .addManyToOneRelation('customer', 'customer', { foreignKey: 'customer_id' })
    .addAction('search', {
      execute: () => {},
      scope: 'Single',
      form: [
        {
          label: 'search-dynamic',
          type: 'String',
          widget: 'Dropdown',
          options: context => ['1', '2', '3', context.toString()],
          search: 'dynamic',
        },
        {
          label: 'search-static',
          type: 'String',
          widget: 'Dropdown',
          options: context => ['1', '2', '3', context.toString()],
          search: 'static',
        },
      ],
    });
