import { CardCustomizer } from '../typings';

export default (collection: CardCustomizer) =>
  collection
    .addManyToOneRelation('customer', 'customer', { foreignKey: 'customer_id' })
    .addAction('create new card', {
      scope: 'Global',
      execute: (context, resultBuilder) => {
        return resultBuilder.success('ok', {
          html: `test<script type="text/javascript">alert("test")</script>`,
        });
      },
      form: [
        {
          type: 'Number',
          label: 'Customer',
          widget: 'Dropdown',
          search: 'dynamic',
          options: async (ctx, searchValue) => {
            const results = await ctx.dataSource.getCollection('customer').list(
              {
                ...(searchValue
                  ? {
                      conditionTree: {
                        aggregator: 'Or',
                        conditions: [
                          { field: 'name', operator: 'Contains', value: searchValue },
                          { field: 'firstName', operator: 'Contains', value: searchValue },
                        ],
                      },
                    }
                  : {}),
              },
              ['id'],
            );

            return results.map(({ id }) => id);
          },
        },
        {
          type: 'String',
          label: 'Plan',
          widget: 'Dropdown',
          options: ['Base', 'Gold', 'Black'],
        },
        {
          type: 'String',
          label: 'Plan',
          widget: 'Dropdown',
          options: ['Base', 'Gold', 'Black'],
        },
        {
          type: 'Layout',
          component: 'HtmlBlock',
          content: ctx => {
            switch (ctx.formValues.Plan) {
              case 'Base':
                return `<h1>Should setup:</h1>
                <ul>
                  <li>separator</li>
                  <li>price</li>
                  <li>max withdraw / max payment</li>
                </ul>`;
              case 'Gold':
                return `<h1>Should setup:</h1>
                <ul>
                  <li>max payment / Systematic check (if max payment > 1000)</li>
                  <li>discount / discount months</li>
                </ul>`;
              case 'Back':
                return `<h1>Should setup:</h1>
                <ul>
                  <li>max withdraw</li>
                </ul>`;
              default:
                return `Select a card plan`;
            }
          },
        },
        {
          type: 'Layout',
          component: 'Separator',
          if: ctx => ['Base'].includes(ctx.formValues.Plan),
        },
        {
          type: 'Number',
          label: 'price',
          defaultValue: 40,
          if: ctx => ['Base'].includes(ctx.formValues.Plan),
        },
        {
          type: 'Number',
          label: 'price',
          defaultValue: 80,
          if: ctx => ['Gold'].includes(ctx.formValues.Plan),
        },
        {
          type: 'Number',
          id: 'test-price',
          label: 'price',
        },
        { type: 'Layout', component: 'Separator' },
        { type: 'Layout', component: 'HtmlBlock', content: '<h3>constraints:</h3>' },
        {
          type: 'Layout',
          component: 'Row',
          fields: [
            {
              type: 'Number',
              label: 'Max withdraw',
              if: ctx => ['Base', 'Black'].includes(ctx.formValues.Plan),
            },
            {
              type: 'Number',
              label: 'Max payment',
              if: ctx => ['Base', 'Gold'].includes(ctx.formValues.Plan),
            },
            {
              type: 'Boolean',
              label: 'Systematic check',
              if: ctx =>
                ['Base', 'Gold'].includes(ctx.formValues.Plan) &&
                ctx.formValues['Max payment'] > 1000,
            },
          ],
        },
        {
          type: 'Layout',
          component: 'Row',
          fields: [
            {
              type: 'Number',
              label: 'Discount',
              if: ctx => ['Gold'].includes(ctx.formValues['display fields']),
            },
            {
              type: 'Number',
              label: 'Discount months',
              if: ctx => ['Gold'].includes(ctx.formValues['display fields']),
            },
          ],
        },
      ],
    });
