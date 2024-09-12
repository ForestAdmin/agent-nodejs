import { CardCustomizer } from '../typings';

export default (collection: CardCustomizer) =>
  collection
    .addManyToOneRelation('customer', 'customer', { foreignKey: 'customer_id' })
    .addAction('action with form', {
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
        {
          type: 'StringList',
          label: 'first_name',
          widget: 'Dropdown',
          search: 'dynamic',
          options: (ctx, searchValue) => ['first Option', 'second option', 'third option', 'test'],
        },
        {
          type: 'Layout',
          component: 'Separator',
          if: ctx => ctx.formValues.first_name?.[0] === 'test',
        },
        // {
        //   type: 'Layout',
        //   component: 'Row',
        //   fields: [
        {
          type: 'Enum',
          label: 'Gender',
          enumValues: ['M', 'F', 'other'],
          if: ctx =>
            ctx.formValues.first_name?.[0] === 'test' && ctx.formValues.Gender_other === 'test',
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
        //   // "if_": lambda ctx: ctx.form_values.get("Number of children") != 0,
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
        //   if: ctx => ctx.formValues.first_name === 'test',
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
        //   // "if_": lambda ctx: ctx.form_values.get("Number of children") != 0,
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
    });
