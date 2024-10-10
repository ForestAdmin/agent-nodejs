import { OwnerCustomizer } from '../typings';

export default (collection: OwnerCustomizer) =>
  collection
    .addOneToManyRelation('stores', 'store', { originKey: 'ownerId' })
    .addOneToManyRelation('posts', 'post', { originKey: 'userId' })
    .addField('fullName', {
      columnType: 'String',
      dependencies: ['firstName', 'lastName'],
      getValues: records => records.map(record => `${record.firstName} ${record.lastName}`),
    })
    .replaceFieldWriting('fullName', fullName => {
      const [firstName, lastName] = (fullName as string).split(' ');

      return { firstName, lastName };
    })
    .replaceFieldSorting('fullName', [
      { field: 'firstName', ascending: true },
      { field: 'lastName', ascending: true },
    ])
    .addAction('Form customization demo', {
      scope: 'Global',
      execute: (context, resultBuilder) => {
        return resultBuilder.success();
      },
      submitButtonLabel: '🫵 Customizable button 🫵',
      description:
        'This is a super action to show the <span style:"color: red;">form customizations</span> 🎉',
      form: [
        {
          // identity
          type: 'Layout',
          component: 'Page',
          previousButtonLabel: 'Not clickable on 1st page 🚫',
          nextButtonLabel: 'Go to address 👉',
          elements: [
            {
              type: 'Layout',
              component: 'Row',
              fields: [
                { type: 'String', id: 'firstName', label: 'First name', isRequired: true },
                { type: 'String', id: 'lastName', label: 'Last name', isRequired: true },
              ],
            },
            { type: 'Layout', component: 'Separator' },
            {
              type: 'Layout',
              component: 'Row',
              fields: [
                {
                  type: 'String',
                  id: 'gender',
                  label: 'Gender',
                  widget: 'Dropdown',
                  isRequired: true,
                  options: [
                    { label: 'Male', value: 'M' },
                    { label: 'Female', value: 'F' },
                    { label: 'Other', value: 'other' },
                  ],
                },
                {
                  type: 'String',
                  id: 'genderOther',
                  label: 'Specify',
                  if: context => context.formValues?.gender === 'other',
                },
              ],
            },
            {
              type: 'Layout',
              component: 'Separator',
              if: context =>
                Boolean(
                  context.formValues.gender &&
                    context.formValues.firstName &&
                    context.formValues.lastName,
                ),
            },
            {
              type: 'Layout',
              component: 'HtmlBlock',
              if: context =>
                Boolean(
                  context.formValues.gender &&
                    context.formValues.firstName &&
                    context.formValues.lastName,
                ),
              content: context => `
              <p>You are ${{ M: '🚹', F: '🚺', other: '⚧️??' }[context.formValues.gender]} <b>${
                context.formValues?.firstName
              } ${context.formValues.lastName}</b></p>
            `,
            },
          ],
        },
        {
          // address
          type: 'Layout',
          component: 'Page',
          previousButtonLabel: '👈 go back to identity',
          nextButtonLabel: 'go to ... 👉',
          elements: [
            {
              type: 'Enum',
              id: 'homeStyle',
              label: 'You live in:',
              enumValues: ['flat', 'house', 'under a bridge', 'at work'],
            },
          ],
        },
        {
          // identity
          type: 'Layout',
          component: 'Page',
          previousButtonLabel: 'not shown on 1st page',
          nextButtonLabel: 'go to ...',
          elements: [],
        },
        {
          // confirmation
          type: 'Layout',
          component: 'Page',
          previousButtonLabel: '👈 go back to',
          nextButtonLabel: 'Not shown on the last page. Submit button instead',
          elements: [
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: context => `
              <p>You are ${{ M: '🚹', F: '🚺', other: '⚧️??' }[context.formValues.gender]} <b>${
                context.formValues?.firstName
              } ${context.formValues.lastName}</b></p>
            `,
            },
          ],
        },
      ],
    });
