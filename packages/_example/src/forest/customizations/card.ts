import { CardCustomizer } from '../typings';

export default (collection: CardCustomizer) =>
  collection
    .addManyToOneRelation('customer', 'customer', { foreignKey: 'customer_id' })
    .addAction('action with form', {
      scope: 'Bulk',
      execute: (context, resultBuilder) => {
        return resultBuilder.success('ok', {
          html: `test<script type="text/javascript">alert("test")</script>`,
        });
      },
      form: [
        // {
        //   type: 'Layout',
        //   component: 'Page',
        //   nextButtonLabel: '==>',
        //   previousButtonLabel: '<==',
        //   elements: [
        {
          type: 'String',
          label: 'display fields',
          widget: 'Dropdown',
          search: 'dynamic',
          options: (ctx, searchValue) => ['config 1', 'config 2', 'config 3'],
        },
        {
          type: 'Layout',
          component: 'HtmlBlock',
          content: ctx => {
            switch (ctx.formValues['display fields']) {
              case 'config 1':
                return `<h1>Should display:</h1>
                <ul>
                  <li>separator</li>
                  <li>field 0</li>
                  <li>row 1, fields 1 and 2</li>
                </ul>`;
              case 'config 2':
                return `<h1>Should display:</h1>
                <ul>
                  <li>row 1, fields 2 and 3</li>
                  <li>row 2, fields 4 and 5</li>
                </ul>`;
              case 'config 3':
                return `<h1>Should display:</h1>
                <ul>
                  <li>row 1, field 1</li>
                </ul>`;
              default:
                return `Select a fields configuration`;
            }
          },
        },
        {
          type: 'Layout',
          component: 'Separator',
          if: ctx => ['config 1'].includes(ctx.formValues['display fields']),
        },
        {
          type: 'String',
          label: 'field 0',
          if: ctx => ['config 1'].includes(ctx.formValues['display fields']),
        },
        {
          type: 'Layout',
          component: 'Row',
          fields: [
            {
              type: 'Number',
              label: 'field 1',
              if: ctx => ['config 1', 'config 3'].includes(ctx.formValues['display fields']),
            },
            {
              type: 'Number',
              label: 'field 2',
              if: ctx => ['config 1', 'config 2'].includes(ctx.formValues['display fields']),
            },
            {
              type: 'Number',
              label: 'field 3',
              if: ctx => ['config 1', 'config 2'].includes(ctx.formValues['display fields']),
            },
          ],
        },
        {
          type: 'Layout',
          component: 'Row',
          fields: [
            {
              type: 'Number',
              label: 'field 4',
              if: ctx => ['config 2'].includes(ctx.formValues['display fields']),
            },
            {
              type: 'Number',
              label: 'field 5',
              if: ctx => ['config 2'].includes(ctx.formValues['display fields']),
            },
          ],
        },
        // {
        //   type: 'Layout',
        //   component: 'Page',
        //   // "if_": lambda ctx: ctx.form_values.get("Number of children") != 0,
        //   elements: [
        { type: 'Number', label: 'Number of children' },
        { type: 'Boolean', label: 'Are they wise' },
        //   ],
        //   nextButtonLabel: '==>',
        //   previousButtonLabel: '<==',
        // },
        // {
        //   type: 'Layout',
        //   component: 'Page',
        //   // "if_": lambda ctx: ctx.form_values.get("Are they wise") is False,
        //   elements: [
        //     {
        //       type: 'Layout',
        //       component: 'Row',
        //       fields: [
        { type: 'StringList', label: 'Why_its_your_fault' },
        { type: 'String', label: 'Why_its_their_fault', widget: 'TextArea' },
        //         ],
        //       },
        //     ],
        //     nextButtonLabel: '==>',
        //     previousButtonLabel: '<==',
        //   },
      ],
    })
    .addAction('static action with form', {
      scope: 'Bulk',
      execute: (context, resultBuilder) => {
        resultBuilder.success('ok');
      },
      form: [
        // {
        //   type: 'Layout',
        //   component: 'Page',
        //   nextButtonLabel: '==>',
        //   previousButtonLabel: '<==',
        //   elements: [
        // {
        //   type: 'Layout',
        //   component: 'Separator',
        // },
        // {
        //   type: 'Layout',
        //   component: 'Row',
        //   fields: [
        {
          type: 'Enum',
          label: 'Gender',
          enumValues: ['M', 'F', 'other'],
        },
        {
          type: 'String',
          label: 'Gender_other',
        },
        //   ],
        // },
        //   ],
        // },
        // {
        //   type: 'Layout',
        //   component: 'Page',
        //   elements: [
        { type: 'Number', label: 'Number of children' },
        // {
        //   type: 'Layout',
        //   component: 'Row',
        //   fields: [
        { type: 'Number', label: 'Age of older child' },
        { type: 'Number', label: 'Age of younger child' },
        //   ],
        // },
        { type: 'Boolean', label: 'Are they wise' },
        //   ],
        //   nextButtonLabel: '==>',
        //   previousButtonLabel: '<==',
        // },
        // {
        //   type: 'Layout',
        //   component: 'Page',
        //   elements: [
        //     {
        //       type: 'Layout',
        //       component: 'Row',
        //       fields: [
        { type: 'StringList', label: 'Why_its_your_fault' },
        { type: 'String', label: 'Why_its_their_fault', widget: 'TextArea' },
        //         ],
        //       },
        //     ],
        //     nextButtonLabel: '==>',
        //     previousButtonLabel: '<==',
        //   },
      ],
    });
