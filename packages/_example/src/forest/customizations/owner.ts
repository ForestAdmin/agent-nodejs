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
        'This is a <strong style="font-size: large;">super</strong> action to show the <span style="color: red;">form customizations</span> 🎉',
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
                {
                  type: 'String',
                  id: 'firstName',
                  label: 'First name',
                  isRequired: true,
                  defaultValue: context => context.caller.firstName,
                },
                {
                  type: 'String',
                  id: 'lastName',
                  label: 'Last name',
                  isRequired: true,
                  defaultValue: context => context.caller.lastName,
                },
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
              <h1>To summarize:</h1>
              <p>You are <b>${context.formValues?.firstName} ${context.formValues.lastName}</b>; ${
                { M: '🚹', F: '🚺', other: '⚧️' }[context.formValues.gender]
              } ${context.formValues.genderOther ? ` (${context.formValues.genderOther})` : ''}</p>
            `,
            },
          ],
        },
        {
          // address
          type: 'Layout',
          component: 'Page',
          previousButtonLabel: '👈 go back to identity',
          nextButtonLabel: 'go to money $ 👉',
          elements: [
            {
              type: 'String',
              id: 'homeStyle',
              label: 'You live:',
              widget: 'Dropdown',
              options: [
                { label: 'in a flat 🏢', value: 'nicely' },
                { label: 'in a house 🏡', value: 'comfy' },
                { label: 'under a bridge 🌉', value: 'poorly' },
                { label: 'at work 🌲', value: 'overbooked' },
              ],
              isRequired: true,
            },

            {
              type: 'String',
              label: 'Where',
              id: 'address',
              widget: 'AddressAutocomplete',
              isRequired: true,
            },
            {
              type: 'Layout',
              component: 'HtmlBlock',
              if: context => Boolean(context.formValues.homeStyle && context.formValues.address),
              content: context => `
              <h1>To summarize:</h1>
              <p>You lived at ${context.formValues.address}, <br>${context.formValues.homeStyle}</p>
            `,
            },
          ],
        },
        {
          // Money
          type: 'Layout',
          component: 'Page',
          previousButtonLabel: '👈 go back to address',
          nextButtonLabel: 'go to summary page 👉',
          elements: [
            {
              type: 'Layout',
              component: 'Row',
              fields: [
                {
                  type: 'Enum',
                  enumValues: ['₿', '$', '€', '£', '💩', 'USD'],
                  id: 'currency',
                  label: 'What is your currency ?',
                },
                {
                  type: 'Number',
                  id: 'savings',
                  label: 'how much did you save in your life ?',
                },
              ],
            },
            {
              type: 'Layout',
              component: 'HtmlBlock',
              if: context => Boolean(context.formValues.currency && context.formValues.savings),
              content: context => `
              <h1>To summarize:</h1>
              <p>You have ${context.formValues.currency}&nbsp;${context.formValues.savings}</p>
            `,
            },
          ],
        },
        {
          // confirmation
          type: 'Layout',
          component: 'Page',
          previousButtonLabel: '👈 go back to money',
          nextButtonLabel: 'Not shown on the last page. Submit button instead',
          elements: [
            {
              type: 'String',
              id: 'extraSummary',
              label: 'Something else to add to the summary',
              widget: 'RichText',
            },
            { type: 'Layout', component: 'Separator' },
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: context => `
                <h1>Preview:</h1>
                <p>You are ${{ M: '🚹', F: '🚺', other: '⚧️' }[context.formValues.gender]} ${
                context.formValues.genderOther ? context.formValues.genderOther : ''
              } <b>${context.formValues?.firstName} ${context.formValues.lastName}</b></p>
                <p>You lived at <b>${context.formValues.address}</b>, <br><b>${
                context.formValues.homeStyle
              }</b></p>
                <p>You have <b>${context.formValues.currency}&nbsp;${
                context.formValues.savings
              }</b></p>
              <br/><br/>
              ${context.formValues.extraSummary ? context.formValues.extraSummary : ''}
              `,
            },
          ],
        },
      ],
    });
